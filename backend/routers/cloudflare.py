"""Cloudflare / DNS yönetimi — zone listeleme & ekleme, A/CNAME kayıt CRUD, otomatik bağlama."""

import asyncio
import socket
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from lib.cloudflare import CloudflareError, cf_request, token
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


class CfSslUpdate(BaseModel):
    ssl: Optional[Literal["off", "flexible", "full", "strict"]] = None
    always_use_https: Optional[bool] = None


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


class CfAutowireResult(BaseModel):
    zone: CfZone
    records: List[CfRecord]
    created_zone: bool
    name_servers: List[str] = []


# ---- yardımcılar -----------------------------------------------------------
async def get_settings() -> dict:
    doc = await db.settings.find_one({"id": SETTINGS_ID})
    return doc or {"id": SETTINGS_ID, "server_ip": ""}


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
    if not token():
        return CfStatus(
            configured=False,
            token_valid=False,
            server_ip=server_ip,
            auto_purge=auto_purge,
            message="CLOUDFLARE_API_TOKEN backend/.env içinde tanımlı değil",
        )
    try:
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
    await db.settings.update_one(
        {"id": SETTINGS_ID}, {"$set": {"server_ip": payload.server_ip.strip()}}, upsert=True
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


@router.post("/autowire", response_model=CfAutowireResult)
async def autowire(payload: CfAutowireRequest):
    """Domain için zone'u bulur/oluşturur, @ + www A kaydını yazar, istenirse siteye bağlar."""
    settings = await get_settings()
    server_ip = (payload.server_ip or settings.get("server_ip") or "").strip()
    if not server_ip:
        raise HTTPException(status_code=400, detail="Önce sunucu IP adresini kaydedin")
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
    if not token() or not settings.get("auto_purge", True):
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
        if not token():
            warning = "Cloudflare token yok — DNS kayıtları silinemedi"
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
    sites = await db.sites.find().to_list(500)

    zones_by_name: dict = {}
    if token():
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
                check.a_record_ok = bool(server_ip) and root.content == server_ip
                if not check.a_record_ok:
                    check.issues.append(
                        f"Kök kayıt {root.content} → beklenen {server_ip or 'sunucu IP tanımsız'}"
                    )
                if not root.proxied:
                    check.issues.append("Proxy (turuncu bulut) kapalı")
            else:
                check.issues.append("Kök A kaydı yok")
            check.www_ok = bool(www) and (not server_ip or www.content == server_ip)
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
    return CfSslSettings(
        zone_id=zone_id,
        ssl=str((ssl_body.get("result") or {}).get("value", "off")),
        always_use_https=(https_body.get("result") or {}).get("value") == "on",
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
    return await get_ssl(zone_id)
