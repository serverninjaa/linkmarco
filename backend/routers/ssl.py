"""Tek tıkla yayına alma: domainin DNS'i sunucuya bakıyor mu kontrol eder ve
deploy/ssl-ads.sh ile Let's Encrypt sertifikasını alıp Nginx'i yeniler.

Güvenlik: yalnızca panelde kayıtlı domainler işlenir (kullanıcı girdisi shell'e gitmez),
komut argüman listesiyle çalıştırılır (shell=False)."""

import asyncio
import os
import socket
import subprocess
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
import httpx
from pydantic import BaseModel

from lib.db import db
from routers.auth import require_admin

router = APIRouter(prefix="/ssl", tags=["ssl"], dependencies=[Depends(require_admin)])

SETTINGS_ID = "cloudflare"  # ayarlar cloudflare router'ı ile aynı dokümanda tutulur
SCRIPT_PATH = Path(__file__).resolve().parents[2] / "deploy" / "ssl-ads.sh"
CERT_DIR = Path("/etc/letsencrypt/live/ads")


class DomainSslStatus(BaseModel):
    domain: str
    site_slug: str
    resolved_ip: str = ""
    dns_ok: bool = False
    cert_ok: bool = False
    ready: bool = False
    issue: str = ""


class SslStatus(BaseModel):
    server_ip: str = ""
    script_available: bool = False
    certbot_available: bool = False
    cert_domains: List[str] = []
    domains: List[DomainSslStatus] = []


class SslIssueRequest(BaseModel):
    domains: Optional[List[str]] = None  # boşsa panelde kayıtlı tüm reklam domainleri


class SslIssueResult(BaseModel):
    ok: bool
    domains: List[str] = []
    output: str = ""
    message: str = ""


def _norm(host: str) -> str:
    return host.strip().lower().removeprefix("www.").split(":")[0]


async def _panel_domains() -> List[tuple[str, str]]:
    out: List[tuple[str, str]] = []
    for site in await db.sites.find().to_list(500):
        for d in site.get("domains") or []:
            domain = _norm(str(d))
            if domain and domain not in {x[0] for x in out}:
                out.append((domain, site.get("slug", "")))
    return out


async def _resolve_live(host: str) -> str:
    """DNS'i doğrudan Cloudflare DoH'a sorar (sunucunun önbelleği yüzünden eski sonuç gelmesin).
    Başarısız olursa sistem çözümleyicisine düşer."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            res = await client.get(
                "https://cloudflare-dns.com/dns-query",
                params={"name": host, "type": "A"},
                headers={"accept": "application/dns-json"},
            )
        answers = (res.json() or {}).get("Answer") or []
        for a in answers:
            if a.get("type") == 1:  # A kaydı
                return str(a.get("data", ""))
    except (httpx.HTTPError, ValueError, KeyError):
        pass
    return await asyncio.to_thread(_resolve, host)


def _resolve(host: str) -> str:
    try:
        return socket.gethostbyname(host)
    except OSError:
        return ""


def _cert_domains() -> List[str]:
    """Mevcut 'ads' sertifikasının kapsadığı domainleri openssl ile okur."""
    cert = CERT_DIR / "cert.pem"
    if not cert.exists():
        return []
    try:
        res = subprocess.run(
            ["openssl", "x509", "-noout", "-ext", "subjectAltName", "-in", str(cert)],
            capture_output=True,
            text=True,
            timeout=15,
        )
    except (OSError, subprocess.SubprocessError):
        return []
    return sorted(
        {
            part.strip().removeprefix("DNS:").strip().lower()
            for part in res.stdout.replace("\n", ",").split(",")
            if part.strip().startswith("DNS:")
        }
    )


@router.get("", response_model=SslStatus)
async def ssl_status():
    settings = await db.settings.find_one({"id": SETTINGS_ID}) or {}
    server_ip = (settings.get("server_ip") or "").strip()
    panel_domain = _norm(os.environ.get("PANEL_DOMAIN", ""))
    certs = await asyncio.to_thread(_cert_domains)

    rows: List[DomainSslStatus] = []
    for domain, slug in await _panel_domains():
        if panel_domain and domain == panel_domain:
            continue  # panel domaini kendi sertifikasını kullanır
        ip = await _resolve_live(domain)
        dns_ok = bool(server_ip) and ip == server_ip
        cert_ok = domain in certs
        issue = ""
        if not server_ip:
            issue = "Sunucu IP tanımlı değil — Cloudflare / DNS sayfasında sunucu IP'sini kaydedin"
        elif not ip:
            issue = "DNS kaydı bulunamadı — kayıt firmasında A kaydı ekleyin"
        elif not dns_ok:
            issue = f"DNS {ip} adresine bakıyor, beklenen {server_ip}"
        elif not cert_ok:
            issue = "Sertifika yok — 'Sertifika al & yayına al'a basın"
        rows.append(
            DomainSslStatus(
                domain=domain,
                site_slug=slug,
                resolved_ip=ip,
                dns_ok=dns_ok,
                cert_ok=cert_ok,
                ready=dns_ok and cert_ok,
                issue=issue,
            )
        )

    return SslStatus(
        server_ip=server_ip,
        script_available=SCRIPT_PATH.exists(),
        certbot_available=bool(await asyncio.to_thread(_which_certbot)),
        cert_domains=certs,
        domains=rows,
    )


def _which_certbot() -> str:
    from shutil import which

    return which("certbot") or ""


def _run_script(domains: List[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(SCRIPT_PATH), *domains],
        capture_output=True,
        text=True,
        timeout=600,
        check=False,
    )


@router.post("/issue", response_model=SslIssueResult)
async def issue_certificate(payload: SslIssueRequest):
    """Sertifikayı alır (tüm reklam domainleri tek SAN sertifikasında) ve Nginx'i yeniler."""
    known = {d for d, _ in await _panel_domains()}
    panel_domain = _norm(os.environ.get("PANEL_DOMAIN", ""))
    known.discard(panel_domain)

    if payload.domains:
        wanted = [_norm(d) for d in payload.domains]
        unknown = [d for d in wanted if d not in known]
        if unknown:
            raise HTTPException(
                status_code=422,
                detail=f"Panelde kayıtlı olmayan domain: {', '.join(unknown)}",
            )
        # Sertifika tek dosyada tutulduğu için mevcut domainleri de dahil ediyoruz.
        domains = sorted(known | set(wanted))
    else:
        domains = sorted(known)

    if not domains:
        raise HTTPException(status_code=400, detail="Panelde reklam domaini yok")
    if not SCRIPT_PATH.exists():
        raise HTTPException(status_code=503, detail=f"Script bulunamadı: {SCRIPT_PATH}")
    if not await asyncio.to_thread(_which_certbot):
        raise HTTPException(
            status_code=503,
            detail="Bu ortamda certbot kurulu değil (yalnızca kendi sunucunuzda çalışır)",
        )

    try:
        res = await asyncio.to_thread(_run_script, domains)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Sertifika işlemi zaman aşımına uğradı") from None

    output = (res.stdout + res.stderr)[-4000:]
    return SslIssueResult(
        ok=res.returncode == 0,
        domains=domains,
        output=output,
        message="Sertifika alındı ve Nginx yenilendi"
        if res.returncode == 0
        else "Sertifika alınamadı — çıktıyı inceleyin",
    )
