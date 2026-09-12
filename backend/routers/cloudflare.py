"""Cloudflare / DNS yönetimi — zone listeleme & ekleme, A/CNAME kayıt CRUD, otomatik bağlama."""

import asyncio
import base64
import ipaddress
import os
import socket
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.cloudflare import CloudflareError, cf_request, configured, global_key, token
from lib.db import db
from routers.auth import require_admin

router = APIRouter(
    prefix="/cloudflare", tags=["cloudflare"], dependencies=[Depends(require_admin)]
)

SETTINGS_ID = "cloudflare"


# ---- şemalar ---------------------------------------------------------------
class CfStatus(BaseModel):
    configured: bool
    token_valid: bool
    token_status: Optional[str] = None
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    server_ip: str = ""
    auto_purge: bool = True
    message: Optional[str] = None


class CfSettingsUpdate(BaseModel):
    server_ip: str = Field(default="", max_length=64)

class CfZone(BaseModel):
    id: str
    name: str
    status: str
    paused: bool = False
    name_servers: List[str] = []


class CfZoneCreate(BaseModel):
    name: str = Field(min_length=3, max_length=253)


class CfRecord(BaseModel):
    id: str
    type: str
    name: str
    content: str
    ttl: int = 1
    proxied: bool = False


class CfRecordInput(BaseModel):
    type: Literal["A", "CNAME"] = "A"
    name: str = Field(min_length=1, max_length=253)
    content: str = Field(min_length=1, max_length=253)
    ttl: int = Field(default=1, ge=1, le=86400)
    proxied: bool = True


class CfAutowireRequest(BaseModel):
    domain: str = Field(min_length=3, max_length=253)
    server_ip: Optional[str] = None
    # Verilirse domain bu sitenin domain listesine de eklenir (domain-site eşleme).
    site_id: Optional[str] = None


class CfDomainCheck(BaseModel):
    domain: str
    site_slug: str = ""
    site_name: str = ""
    zone_id: Optional[str] = None
    zone_status: str = "missing"
    name_servers: List[str] = []
    ns_delegated: bool = False
    a_record_ok: bool = False
    a_record_content: str = ""
    proxied: bool = False
    www_ok: bool = False
    resolved_ips: List[str] = []
    issues: List[str] = []


class CfSslSettings(BaseModel):
    zone_id: str
    ssl: str = "off"
    always_use_https: bool = False
    ipv6: bool = False


class CfSslUpdate(BaseModel):
    ssl: Optional[Literal["off", "flexible", "full", "strict"]] = None
    always_use_https: Optional[bool] = None
    ipv6: Optional[bool] = None


class CfAutoPurgeUpdate(BaseModel):
    auto_purge: bool


class CfDomainRemoveRequest(BaseModel):
    site_id: str
    domain: str
    delete_dns: bool = False


class CfDomainRemoveResult(BaseModel):
    domain: str
    removed_from_site: bool
    deleted_records: List[str] = []
    warning: Optional[str] = None


class CfTunnelStatus(BaseModel):
    configured: bool = False
    tunnel_id: str = ""
    tunnel_name: str = ""
    status: str = "missing"  # healthy | degraded | down | missing
    connections: int = 0
    colos: List[str] = []
    ingress_ok: bool = False
    target: str = ""
    message: Optional[str] = None


class CfTunnelRebuildRequest(BaseModel):
    name: str = Field(default="marco-tunnel", min_length=3, max_length=64)
    include_panel: bool = True


class CfDirectModeRequest(BaseModel):
    server_ip: str = ""
    include_panel: bool = True


class CfDirectModeResult(BaseModel):
    server_ip: str
    wired_domains: List[str] = []
    warnings: List[str] = []
    ssl_command: str = ""


class CfTunnelAttachResult(BaseModel):
    panel_domain: str
    target: str
    records: List[str] = []


class CfTunnelRebuildResult(BaseModel):
    tunnel_id: str
    tunnel_name: str
    target: str
    install_command: str
    deleted_tunnels: List[str] = []
    rewired_domains: List[str] = []
    warnings: List[str] = []


class CfAutowireResult(BaseModel):
    zone: CfZone
    records: List[CfRecord]
    created_zone: bool
    name_servers: List[str] = []


# ---- yardımcılar -----------------------------------------------------------
async def get_settings() -> dict:
    doc = await db.settings.find_one({"id": SETTINGS_ID})
    return doc or {"id": SETTINGS_ID, "server_ip": ""}


def valid_ipv4(value: str) -> bool:
    try:
        ipaddress.IPv4Address(value.strip())
        return True
    except ValueError:
        return False


async def call(method: str, path: str, **kwargs) -> dict:
    try:
        return await cf_request(method, path, **kwargs)
    except CloudflareError as exc:
        # Cloudflare izin hatalarını (kod 10000 / 1105) uygulanabilir mesaja çevir.
        codes = {e.get("code") for e in exc.errors if isinstance(e, dict)}
        text = str(exc)
        if "purge_cache" in path and (10000 in codes or "Authentication error" in text):
            detail = (
                "Önbellek temizlenemedi: API token'ında 'Zone → Cache Purge → Purge' izni yok. "
                "Cloudflare > My Profile > API Tokens > token'ı düzenle → bu izni ekle."
            )
        elif "zone.create" in text or (path == "/zones" and method == "POST"):
            detail = (
                "Zone oluşturulamadı: token'a 'Account → Zone → Edit' izni gerekir. "
                f"Cloudflare mesajı: {text}"
            )
        elif 10000 in codes or "Authentication error" in text:
            detail = (
                "Cloudflare kimlik doğrulama hatası: token geçersiz ya da bu işlem için "
                f"gerekli izne sahip değil. ({text})"
            )
        else:
            detail = f"Cloudflare: {text}"
        # 400 kullanılır: 502 ingress tarafından kendi hata sayfasıyla değiştiriliyor.
        raise HTTPException(status_code=400, detail=detail)


def to_zone(z: dict) -> CfZone:
    return CfZone(
        id=z["id"],
        name=z["name"],
        status=z.get("status", "unknown"),
        paused=bool(z.get("paused", False)),
        name_servers=z.get("name_servers") or [],
    )


def to_record(r: dict) -> CfRecord:
    return CfRecord(
        id=r["id"],
        type=r["type"],
        name=r["name"],
        content=r.get("content", ""),
        ttl=int(r.get("ttl", 1)),
        proxied=bool(r.get("proxied", False)),
    )


async def first_account_id() -> Optional[str]:
    body = await call("GET", "/accounts", params={"page": 1, "per_page": 5})
    accounts = body.get("result") or []
    return accounts[0]["id"] if accounts else None


# ---- uçlar -----------------------------------------------------------------
@router.get("/status", response_model=CfStatus)
async def status():
    settings = await get_settings()
    server_ip = settings.get("server_ip", "")
    auto_purge = bool(settings.get("auto_purge", True))
    if not configured():
        return CfStatus(
            configured=False,
            token_valid=False,
            server_ip=server_ip,
            auto_purge=auto_purge,
            message="Cloudflare kimliği yok — .env içinde CLOUDFLARE_API_TOKEN ya da CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY girin",
        )
    try:
        if global_key():
            await cf_request("GET", "/zones", params={"per_page": 1})
            verify = {"result": {"status": "active (global key)"}}
        else:
            verify = await cf_request("GET", "/user/tokens/verify")
    except CloudflareError as exc:
        return CfStatus(
            configured=True,
            token_valid=False,
            server_ip=server_ip,
            auto_purge=auto_purge,
            message=str(exc),
        )
    account_id = settings.get("account_id")
    account_name = settings.get("account_name")
    if not account_id:
        try:
            body = await cf_request("GET", "/accounts", params={"page": 1, "per_page": 5})
            accounts = body.get("result") or []
            if accounts:
                account_id = accounts[0]["id"]
                account_name = accounts[0].get("name")
                await db.settings.update_one(
                    {"id": SETTINGS_ID},
                    {"$set": {"account_id": account_id, "account_name": account_name}},
                    upsert=True,
                )
        except CloudflareError:
            account_id = None  # token'da Account:Read izni olmayabilir; zone listeleme yine çalışır
    return CfStatus(
        configured=True,
        token_valid=True,
        token_status=(verify.get("result") or {}).get("status"),
        account_id=account_id,
        account_name=account_name,
        server_ip=server_ip,
        auto_purge=auto_purge,
    )


@router.put("/settings", response_model=CfStatus)
async def update_settings(payload: CfSettingsUpdate):
    server_ip = payload.server_ip.strip()
    if server_ip and not valid_ipv4(server_ip):
        raise HTTPException(
            status_code=400,
            detail=f"'{server_ip}' geçerli bir IPv4 adresi değil (örn. 203.161.57.207)",
        )
    await db.settings.update_one(
        {"id": SETTINGS_ID}, {"$set": {"server_ip": server_ip}}, upsert=True
    )
    return await status()


@router.get("/zones", response_model=List[CfZone])
async def list_zones():
    body = await call("GET", "/zones", params={"page": 1, "per_page": 100})
    return [to_zone(z) for z in body.get("result") or []]


@router.post("/zones", response_model=CfZone)
async def create_zone(payload: CfZoneCreate):
    settings = await get_settings()
    account_id = settings.get("account_id") or await first_account_id()
    if not account_id:
        raise HTTPException(
            status_code=400,
            detail="Hesap kimliği bulunamadı — token'a Account:Read izni ekleyin",
        )
    body = await call(
        "POST",
        "/zones",
        json={"name": payload.name.strip().lower(), "account": {"id": account_id}, "type": "full"},
    )
    return to_zone(body["result"])


@router.get("/zones/{zone_id}/records", response_model=List[CfRecord])
async def list_records(zone_id: str):
    body = await call(
        "GET", f"/zones/{zone_id}/dns_records", params={"page": 1, "per_page": 200}
    )
    return [to_record(r) for r in body.get("result") or []]


@router.post("/zones/{zone_id}/records", response_model=CfRecord)
async def create_record(zone_id: str, payload: CfRecordInput):
    body = await call(
        "POST", f"/zones/{zone_id}/dns_records", json=payload.model_dump()
    )
    return to_record(body["result"])


@router.put("/zones/{zone_id}/records/{record_id}", response_model=CfRecord)
async def update_record(zone_id: str, record_id: str, payload: CfRecordInput):
    body = await call(
        "PUT", f"/zones/{zone_id}/dns_records/{record_id}", json=payload.model_dump()
    )
    return to_record(body["result"])


@router.delete("/zones/{zone_id}/records/{record_id}")
async def delete_record(zone_id: str, record_id: str):
    await call("DELETE", f"/zones/{zone_id}/dns_records/{record_id}")
    return {"ok": True}


# ---- Cloudflare Tunnel -----------------------------------------------------
def tunnel_target(tunnel_id: str) -> str:
    return f"{tunnel_id}.cfargotunnel.com"


async def account_id_or_400() -> str:
    settings = await get_settings()
    account_id = settings.get("account_id") or await first_account_id()
    if not account_id:
        raise HTTPException(
            status_code=400, detail="Cloudflare hesap kimliği bulunamadı (Account:Read izni gerekli)"
        )
    return account_id


async def wire_domain_to_target(
    domain: str, content: str, record_type: str = "CNAME", proxied: bool = True
) -> List[CfRecord]:
    """Domainin kök + www kaydını tek hedefe bağlar; çakışan A/CNAME kayıtlarını temizler."""
    body = await call("GET", "/zones", params={"name": domain, "per_page": 5})
    results = body.get("result") or []
    if not results:
        raise HTTPException(status_code=404, detail=f"{domain} için Cloudflare zone bulunamadı")
    zone_id = results[0]["id"]
    records = await list_records(zone_id)
    out: List[CfRecord] = []
    for name in (domain, f"www.{domain}"):
        desired = CfRecordInput(
            type=record_type, name=name, content=content, ttl=120, proxied=proxied  # type: ignore[arg-type]
        )
        conflicting = [r for r in records if r.name == name and r.type in ("A", "AAAA", "CNAME")]
        for extra in conflicting[1:]:
            await call("DELETE", f"/zones/{zone_id}/dns_records/{extra.id}")
        if conflicting:
            out.append(await update_record(zone_id, conflicting[0].id, desired))
        else:
            out.append(await create_record(zone_id, desired))
    for setting, value in (("ipv6", "off"), ("ssl_automatic_mode", "custom"), ("ssl", "flexible")):
        try:
            await cf_request("PATCH", f"/zones/{zone_id}/settings/{setting}", json={"value": value})
        except CloudflareError:
            pass
    return out


@router.get("/tunnel", response_model=CfTunnelStatus)
async def tunnel_status():
    settings = await get_settings()
    tunnel_id = settings.get("tunnel_id") or ""
    if not configured():
        return CfTunnelStatus(message="Cloudflare kimliği yok")
    if not tunnel_id:
        return CfTunnelStatus(
            configured=True, message="Henüz tünel kurulmadı — 'Tüneli sıfırdan kur'a basın"
        )
    account_id = await account_id_or_400()
    try:
        body = await cf_request("GET", f"/accounts/{account_id}/cfd_tunnel/{tunnel_id}")
        cfg = await cf_request(
            "GET", f"/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations"
        )
    except CloudflareError as exc:
        return CfTunnelStatus(
            configured=True,
            tunnel_id=tunnel_id,
            tunnel_name=settings.get("tunnel_name") or "",
            message=str(exc),
        )
    result = body.get("result") or {}
    conns = result.get("connections") or []
    ingress = ((cfg.get("result") or {}).get("config") or {}).get("ingress") or []
    return CfTunnelStatus(
        configured=True,
        tunnel_id=tunnel_id,
        tunnel_name=result.get("name") or "",
        status=result.get("status") or "down",
        connections=len(conns),
        colos=sorted({c.get("colo_name", "") for c in conns if c.get("colo_name")}),
        ingress_ok=any(i.get("service", "").startswith("http://127.0.0.1") for i in ingress),
        target=tunnel_target(tunnel_id),
    )


def panel_ingress(panel_domain: str) -> List[dict]:
    """Panel domaini origin'de 80 → 443 yönlendirmesi yapar; tünelde HTTPS origin şart
    (aksi halde sonsuz redirect döngüsü). Sertifika Certbot'tan geldiği için doğrulanabilir."""
    return [
        {
            "hostname": host,
            "service": "https://127.0.0.1:443",
            "originRequest": {"originServerName": panel_domain},
        }
        for host in (panel_domain, f"www.{panel_domain}")
    ]


@router.post("/direct-mode", response_model=CfDirectModeResult)
async def direct_mode(payload: CfDirectModeRequest):
    """ÖNERİLEN MOD: tüm domainleri Cloudflare proxy'si KAPALI şekilde doğrudan sunucuya bağlar.

    Cloudflare yalnızca DNS sağlayıcısı kalır; edge kaynaklı 1034/522/530 hataları imkânsız hale
    gelir. HTTPS sunucudaki Let's Encrypt sertifikalarıyla sağlanır (deploy/ssl-ads.sh).
    """
    settings = await get_settings()
    server_ip = (payload.server_ip or settings.get("server_ip") or "").strip()
    if not server_ip:
        raise HTTPException(status_code=400, detail="Sunucu IP tanımlı değil")
    try:
        ipaddress.ip_address(server_ip)
    except ValueError:
        raise HTTPException(status_code=422, detail="Geçersiz sunucu IP adresi") from None

    # Tünel modundan çıkıyoruz: autowire ve doğrulama artık IP bekler.
    await db.settings.update_one(
        {"id": SETTINGS_ID},
        {"$set": {"server_ip": server_ip, "tunnel_id": "", "tunnel_name": ""}},
        upsert=True,
    )

    domains: List[str] = []
    for site in await db.sites.find().to_list(500):
        for d in site.get("domains") or []:
            normalized = str(d).strip().lower().removeprefix("www.")
            if normalized and normalized not in domains:
                domains.append(normalized)
    if payload.include_panel:
        panel = os.environ.get("PANEL_DOMAIN", "").strip().lower().removeprefix("www.")
        if panel and panel not in domains:
            domains.append(panel)

    wired: List[str] = []
    warnings: List[str] = []
    for domain in domains:
        try:
            await wire_domain_to_target(domain, server_ip, record_type="A", proxied=False)
            wired.append(domain)
        except (CloudflareError, HTTPException) as exc:
            warnings.append(f"{domain}: {getattr(exc, 'detail', str(exc))}")

    return CfDirectModeResult(
        server_ip=server_ip,
        wired_domains=wired,
        warnings=warnings,
        ssl_command=(
            "bash /opt/adcore/deploy/ssl-ads.sh " + " ".join(wired) if wired else ""
        ),
    )


@router.post("/tunnel/attach-panel", response_model=CfTunnelAttachResult)
async def tunnel_attach_panel():
    """Panel domainini mevcut tünele ekler — yeni token/VPS işlemi gerektirmez."""
    settings = await get_settings()
    tunnel_id = settings.get("tunnel_id") or ""
    if not tunnel_id:
        raise HTTPException(status_code=400, detail="Önce tüneli kurun")
    panel_domain = os.environ.get("PANEL_DOMAIN", "").strip().lower().removeprefix("www.")
    if not panel_domain:
        raise HTTPException(
            status_code=400, detail="PANEL_DOMAIN tanımlı değil (backend/.env)"
        )
    account_id = await account_id_or_400()
    ingress = panel_ingress(panel_domain) + [{"service": "http://127.0.0.1:80"}]
    await call(
        "PUT",
        f"/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations",
        json={"config": {"ingress": ingress}},
    )
    records = await wire_domain_to_target(panel_domain, tunnel_target(tunnel_id))
    return CfTunnelAttachResult(
        panel_domain=panel_domain,
        target=tunnel_target(tunnel_id),
        records=[f"{r.type} {r.name} → {r.content}" for r in records],
    )


@router.post("/tunnel/rebuild", response_model=CfTunnelRebuildResult)
async def tunnel_rebuild(payload: CfTunnelRebuildRequest):
    """Tüm tünelleri silip tek bir 'catch-all' tünel kurar ve domainleri ona bağlar."""
    account_id = await account_id_or_400()
    warnings: List[str] = []
    deleted: List[str] = []

    body = await call("GET", f"/accounts/{account_id}/cfd_tunnel", params={"is_deleted": "false"})
    for t in body.get("result") or []:
        try:
            await cf_request("DELETE", f"/accounts/{account_id}/cfd_tunnel/{t['id']}/connections")
            await cf_request("DELETE", f"/accounts/{account_id}/cfd_tunnel/{t['id']}")
            deleted.append(t.get("name") or t["id"])
        except CloudflareError as exc:
            warnings.append(f"{t.get('name')} silinemedi: {exc}")

    secret = base64.b64encode(os.urandom(32)).decode()
    created = await call(
        "POST",
        f"/accounts/{account_id}/cfd_tunnel",
        json={"name": payload.name.strip(), "tunnel_secret": secret, "config_src": "cloudflare"},
    )
    tunnel = created["result"]
    tunnel_id = tunnel["id"]

    # Catch-all ingress: hostname yazmıyoruz — CNAME'i bu tünele bakan HER domain çalışır,
    # cloudflared orijinal Host başlığını olduğu gibi Nginx'e iletir. Panel domaini origin'de
    # 80 → 443 yönlendirdiği için kendi HTTPS kuralıyla catch-all'dan ÖNCE gelir.
    panel_domain = os.environ.get("PANEL_DOMAIN", "").strip().lower().removeprefix("www.")
    ingress = (panel_ingress(panel_domain) if panel_domain else []) + [
        {"service": "http://127.0.0.1:80"}
    ]
    await call(
        "PUT",
        f"/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations",
        json={"config": {"ingress": ingress}},
    )
    token_body = await call("GET", f"/accounts/{account_id}/cfd_tunnel/{tunnel_id}/token")
    install_token = token_body.get("result") or ""

    await db.settings.update_one(
        {"id": SETTINGS_ID},
        {"$set": {"tunnel_id": tunnel_id, "tunnel_name": tunnel["name"], "account_id": account_id}},
        upsert=True,
    )

    target = tunnel_target(tunnel_id)
    domains: List[str] = []
    for site in await db.sites.find().to_list(500):
        for d in site.get("domains") or []:
            normalized = str(d).strip().lower().removeprefix("www.")
            if normalized and normalized not in domains:
                domains.append(normalized)
    panel_domain = os.environ.get("PANEL_DOMAIN", "").strip().lower().removeprefix("www.")
    if payload.include_panel and panel_domain and panel_domain not in domains:
        domains.append(panel_domain)

    rewired: List[str] = []
    for domain in domains:
        try:
            await wire_domain_to_target(domain, target)
            rewired.append(domain)
        except (CloudflareError, HTTPException) as exc:
            warnings.append(f"{domain}: {getattr(exc, 'detail', str(exc))}")

    install_command = (
        "curl -fsSL -o /tmp/cloudflared.deb "
        "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb "
        "&& dpkg -i /tmp/cloudflared.deb; "
        "cloudflared service uninstall 2>/dev/null; "
        f"cloudflared service install {install_token} "
        "&& systemctl enable --now cloudflared && sleep 8 && systemctl is-active cloudflared"
    )
    return CfTunnelRebuildResult(
        tunnel_id=tunnel_id,
        tunnel_name=tunnel["name"],
        target=target,
        install_command=install_command,
        deleted_tunnels=deleted,
        rewired_domains=rewired,
        warnings=warnings,
    )


@router.post("/autowire", response_model=CfAutowireResult)
async def autowire(payload: CfAutowireRequest):
    """Domain için zone'u bulur/oluşturur, kök + www kaydını yazar, istenirse siteye bağlar.

    Tünel kuruluysa IP yerine tünele bakan CNAME yazılır (origin IP hiç açığa çıkmaz).
    """
    settings = await get_settings()
    tunnel_id = settings.get("tunnel_id") or ""
    if tunnel_id:
        domain = payload.domain.strip().lower().removeprefix("www.")
        body = await call("GET", "/zones", params={"name": domain, "per_page": 5})
        results = body.get("result") or []
        created_zone = False
        if results:
            zone = to_zone(results[0])
        else:
            zone = await create_zone(CfZoneCreate(name=domain))
            created_zone = True
        out = await wire_domain_to_target(domain, tunnel_target(tunnel_id))
        if payload.site_id:
            site = await db.sites.find_one({"id": payload.site_id})
            if not site:
                raise HTTPException(status_code=404, detail="Site bulunamadı")
            await db.sites.update_one({"id": payload.site_id}, {"$addToSet": {"domains": domain}})
        fresh = await call("GET", f"/zones/{zone.id}")
        zone = to_zone(fresh["result"])
        return CfAutowireResult(
            zone=zone, records=out, created_zone=created_zone, name_servers=zone.name_servers
        )

    server_ip = (payload.server_ip or settings.get("server_ip") or "").strip()
    if not server_ip:
        raise HTTPException(
            status_code=400,
            detail="Önce 'Sunucu IP adresi' alanına sunucunun IPv4 adresini kaydedin",
        )
    if not valid_ipv4(server_ip):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Kayıtlı sunucu IP'si geçersiz: '{server_ip}'. "
                "Sunucu IP adresi alanına geçerli bir IPv4 yazın (örn. 203.161.57.207)."
            ),
        )
    domain = payload.domain.strip().lower().removeprefix("www.")

    body = await call("GET", "/zones", params={"name": domain, "per_page": 5})
    results = body.get("result") or []
    created_zone = False
    if results:
        zone = to_zone(results[0])
    else:
        zone = await create_zone(CfZoneCreate(name=domain))
        created_zone = True

    records = await list_records(zone.id)
    out: List[CfRecord] = []
    for name in (domain, f"www.{domain}"):
        desired = CfRecordInput(type="A", name=name, content=server_ip, ttl=1, proxied=True)
        # Aynı isimdeki A/CNAME kayıtları çakışır (Cloudflare "record with that host already
        # exists" hatası): ilkini güncelle, fazlalıkları sil. MX/TXT gibi kayıtlara dokunulmaz.
        conflicting = [r for r in records if r.name == name and r.type in ("A", "CNAME")]
        if conflicting:
            out.append(await update_record(zone.id, conflicting[0].id, desired))
            for extra in conflicting[1:]:
                await call("DELETE", f"/zones/{zone.id}/dns_records/{extra.id}")
        else:
            out.append(await create_record(zone.id, desired))

    # Yeni bağlanan domain için güvenli varsayılanlar (best-effort, hata olursa yoksay):
    #  - IPv6 kapalı: bazı ağlarda IPv6 edge 1034 (Edge IP Restricted) veriyor, origin IPv4.
    #  - Automatic SSL/TLS kapalı + Flexible: origin'de bu domaine ait sertifika yok, aksi
    #    halde Cloudflare zone'u kendiliğinden Full (strict)'e çevirip 526 üretiyor.
    for setting, value in (
        ("ipv6", "off"),
        ("ssl_automatic_mode", "custom"),
        ("ssl", "flexible"),
    ):
        try:
            await cf_request(
                "PATCH", f"/zones/{zone.id}/settings/{setting}", json={"value": value}
            )
        except CloudflareError:
            pass

    if payload.site_id:
        site = await db.sites.find_one({"id": payload.site_id})
        if not site:
            raise HTTPException(status_code=404, detail="Site bulunamadı")
        await db.sites.update_one({"id": payload.site_id}, {"$addToSet": {"domains": domain}})

    fresh = await call("GET", f"/zones/{zone.id}")
    zone = to_zone(fresh["result"])
    return CfAutowireResult(
        zone=zone, records=out, created_zone=created_zone, name_servers=zone.name_servers
    )


@router.put("/auto-purge", response_model=CfStatus)
async def set_auto_purge(payload: CfAutoPurgeUpdate):
    await db.settings.update_one(
        {"id": SETTINGS_ID}, {"$set": {"auto_purge": payload.auto_purge}}, upsert=True
    )
    return await status()


async def purge_site_cache(site_id: str) -> List[str]:
    """Sitenin domainlerine ait zone'ların önbelleğini boşaltır (best-effort)."""
    settings = await get_settings()
    if not configured() or not settings.get("auto_purge", True):
        return []
    site = await db.sites.find_one({"id": site_id})
    domains = [str(d).lower().removeprefix("www.") for d in (site or {}).get("domains") or []]
    if not domains:
        return []
    purged: List[str] = []
    try:
        body = await cf_request("GET", "/zones", params={"page": 1, "per_page": 200})
        zones = {z["name"]: z["id"] for z in body.get("result") or []}
        for domain in domains:
            zone_id = zones.get(domain)
            if not zone_id:
                continue
            await cf_request(
                "POST", f"/zones/{zone_id}/purge_cache", json={"purge_everything": True}
            )
            purged.append(domain)
    except CloudflareError:
        return purged  # önbellek temizliği kaydı engellememeli
    return purged


@router.post("/remove-domain", response_model=CfDomainRemoveResult)
async def remove_domain(payload: CfDomainRemoveRequest):
    """Domaini siteden kaldırır; istenirse Cloudflare'daki kök + www kayıtlarını da siler."""
    domain = payload.domain.strip().lower().removeprefix("www.")
    site = await db.sites.find_one({"id": payload.site_id})
    if not site:
        raise HTTPException(status_code=404, detail="Site bulunamadı")
    res = await db.sites.update_one({"id": payload.site_id}, {"$pull": {"domains": domain}})

    deleted: List[str] = []
    warning: Optional[str] = None
    if payload.delete_dns:
        if not configured():
            warning = "Cloudflare kimliği yok — DNS kayıtları silinemedi"
        else:
            try:
                body = await cf_request("GET", "/zones", params={"name": domain, "per_page": 5})
                zones = body.get("result") or []
                if not zones:
                    warning = "Cloudflare'da zone bulunamadı"
                else:
                    zone_id = zones[0]["id"]
                    records = await list_records(zone_id)
                    for r in records:
                        if r.name in (domain, f"www.{domain}") and r.type in ("A", "CNAME"):
                            await cf_request("DELETE", f"/zones/{zone_id}/dns_records/{r.id}")
                            deleted.append(f"{r.type} {r.name}")
            except CloudflareError as exc:
                warning = f"Cloudflare: {exc}"
    return CfDomainRemoveResult(
        domain=domain,
        removed_from_site=res.modified_count > 0,
        deleted_records=deleted,
        warning=warning,
    )


@router.get("/verify-domains", response_model=List[CfDomainCheck])
async def verify_domains():
    """Panelde kayıtlı her domain için zone, NS delegasyonu ve A kaydı doğruluğunu kontrol eder."""
    settings = await get_settings()
    server_ip = (settings.get("server_ip") or "").strip()
    tunnel_id = settings.get("tunnel_id") or ""
    # Tünel kuruluysa beklenen hedef IP değil, tünel CNAME'idir.
    expected = tunnel_target(tunnel_id) if tunnel_id else server_ip
    sites = await db.sites.find().to_list(500)

    zones_by_name: dict = {}
    if configured():
        try:
            body = await cf_request("GET", "/zones", params={"page": 1, "per_page": 200})
            zones_by_name = {z["name"]: z for z in body.get("result") or []}
        except CloudflareError:
            zones_by_name = {}

    checks: List[CfDomainCheck] = []
    for site in sites:
        for domain in site.get("domains") or []:
            domain = str(domain).lower().removeprefix("www.")
            check = CfDomainCheck(
                domain=domain, site_slug=site.get("slug", ""), site_name=site.get("name", "")
            )
            # Gerçek DNS çözümlemesi (Cloudflare proxy açıkken CF edge IP'leri döner).
            try:
                infos = await asyncio.get_running_loop().getaddrinfo(
                    domain, None, family=socket.AF_INET
                )
                check.resolved_ips = sorted({i[4][0] for i in infos})
            except (socket.gaierror, OSError):
                check.issues.append("Domain DNS'te çözümlenemiyor")

            zone = zones_by_name.get(domain)
            if not zone:
                check.issues.append("Cloudflare'da zone yok")
                checks.append(check)
                continue

            check.zone_id = zone["id"]
            check.zone_status = zone.get("status", "unknown")
            check.name_servers = zone.get("name_servers") or []
            check.ns_delegated = check.zone_status == "active"
            if not check.ns_delegated:
                check.issues.append("Nameserver'lar Cloudflare'a yönlenmemiş (zone pending)")

            try:
                records = await list_records(zone["id"])
            except HTTPException:
                check.issues.append("DNS kayıtları okunamadı (token izni?)")
                checks.append(check)
                continue

            root = next((r for r in records if r.name == domain and r.type in ("A", "CNAME")), None)
            www = next(
                (r for r in records if r.name == f"www.{domain}" and r.type in ("A", "CNAME")), None
            )
            if root:
                check.a_record_content = root.content
                check.proxied = root.proxied
                check.a_record_ok = bool(expected) and root.content == expected
                if not check.a_record_ok:
                    check.issues.append(
                        f"Kök kayıt {root.content} → beklenen {expected or 'hedef tanımsız'}"
                    )
                if not root.proxied:
                    check.issues.append("Proxy (turuncu bulut) kapalı")
            else:
                check.issues.append("Kök A kaydı yok")
            check.www_ok = bool(www) and (not expected or www.content == expected)
            if not www:
                check.issues.append("www kaydı yok")
            checks.append(check)
    return checks


@router.post("/zones/{zone_id}/purge-cache")
async def purge_cache(zone_id: str):
    """Tasarım güncellemesi sonrası tüm Cloudflare önbelleğini boşaltır."""
    await call("POST", f"/zones/{zone_id}/purge_cache", json={"purge_everything": True})
    return {"ok": True}


@router.get("/zones/{zone_id}/ssl", response_model=CfSslSettings)
async def get_ssl(zone_id: str):
    ssl_body = await call("GET", f"/zones/{zone_id}/settings/ssl")
    https_body = await call("GET", f"/zones/{zone_id}/settings/always_use_https")
    ipv6_body = await call("GET", f"/zones/{zone_id}/settings/ipv6")
    return CfSslSettings(
        zone_id=zone_id,
        ssl=str((ssl_body.get("result") or {}).get("value", "off")),
        always_use_https=(https_body.get("result") or {}).get("value") == "on",
        ipv6=(ipv6_body.get("result") or {}).get("value") == "on",
    )


@router.put("/zones/{zone_id}/ssl", response_model=CfSslSettings)
async def update_ssl(zone_id: str, payload: CfSslUpdate):
    if payload.ssl is not None:
        await call("PATCH", f"/zones/{zone_id}/settings/ssl", json={"value": payload.ssl})
    if payload.always_use_https is not None:
        await call(
            "PATCH",
            f"/zones/{zone_id}/settings/always_use_https",
            json={"value": "on" if payload.always_use_https else "off"},
        )
    if payload.ipv6 is not None:
        await call(
            "PATCH",
            f"/zones/{zone_id}/settings/ipv6",
            json={"value": "on" if payload.ipv6 else "off"},
        )
    return await get_ssl(zone_id)
