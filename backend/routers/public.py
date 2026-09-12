"""Public visitor API — resolves the active site by Host header or ?slug= preview."""

import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from lib.dates import now_tz
from lib.db import db
from models.schemas import AdSlot, PublicSite, Site

router = APIRouter(prefix="/public", tags=["public"])


def _normalize(host: str) -> str:
    return host.split(":")[0].strip().lower().removeprefix("www.")


class HostRole(BaseModel):
    """Gelen Host başlığının rolü: yönetim paneli mi, ziyaretçi portalı mı."""

    host: str
    role: str  # "panel" | "portal"
    slug: Optional[str] = None
    panel_domain: str = ""


@router.get("/host-role", response_model=HostRole)
async def host_role(request: Request, host: Optional[str] = None):
    candidate = _normalize(host or request.headers.get("host", ""))
    panel_domain = _normalize(os.environ.get("PANEL_DOMAIN", ""))

    # Panel domaini tanımlıysa yalnızca o host paneldir.
    if panel_domain:
        if candidate == panel_domain:
            return HostRole(host=candidate, role="panel", panel_domain=panel_domain)
        site = await db.sites.find_one({"domains": candidate}, {"slug": 1})
        return HostRole(
            host=candidate,
            role="portal",
            slug=(site or {}).get("slug"),
            panel_domain=panel_domain,
        )

    # PANEL_DOMAIN tanımsız (preview/geliştirme): bilinen reklam domainiyse portal, değilse panel.
    site = await db.sites.find_one({"domains": candidate}, {"slug": 1})
    if site:
        return HostRole(host=candidate, role="portal", slug=site.get("slug"))
    return HostRole(host=candidate, role="panel")


@router.get("/site", response_model=PublicSite)
async def resolve_site(request: Request, slug: Optional[str] = None, host: Optional[str] = None):
    doc = None
    candidate = _normalize(host or request.headers.get("host", ""))
    if slug:
        doc = await db.sites.find_one({"slug": slug, "active": True})
    if doc is None and candidate:
        doc = await db.sites.find_one({"domains": candidate, "active": True})
        # Panelden aktif edilmemiş domain: tasarım/kartlar gösterilmez, "hazırlanıyor" ekranı çıkar.
        if doc is not None:
            active_domain = _normalize(doc.get("active_domain") or "")
            if active_domain and active_domain != candidate:
                return PublicSite(site=Site(**doc), slots=[], status="pending")
    if doc is None:
        doc = await db.sites.find_one({"active": True})
    if doc is None:
        raise HTTPException(status_code=404, detail="Yayında site yok")
    site = Site(**doc)
    slot_docs = (
        await db.ad_slots.find({"site_id": site.id, "active": True}).sort("order", 1).to_list(500)
    )
    return PublicSite(site=site, slots=[AdSlot(**s) for s in slot_docs])


@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots_txt(request: Request, host: Optional[str] = None):
    """Host'a göre robots.txt: panel domaini tamamen kapalı, reklam domainleri açık."""
    candidate = _normalize(host or request.headers.get("host", ""))
    panel_domain = _normalize(os.environ.get("PANEL_DOMAIN", ""))
    if panel_domain and candidate == panel_domain:
        return PlainTextResponse("User-agent: *\nDisallow: /\n")
    base = f"https://{candidate}" if candidate else ""
    lines = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /api/",
    ]
    if base:
        lines.append(f"Sitemap: {base}/sitemap.xml")
    return PlainTextResponse("\n".join(lines) + "\n")


@router.get("/sitemap.xml")
async def sitemap_xml(request: Request, host: Optional[str] = None):
    """Host'a göre sitemap: o domainin sitesi ve reklam kartlarının hedefleri değil, sayfaları listelenir."""
    candidate = _normalize(host or request.headers.get("host", ""))
    panel_domain = _normalize(os.environ.get("PANEL_DOMAIN", ""))
    if panel_domain and candidate == panel_domain:
        raise HTTPException(status_code=404, detail="Panel domaini için sitemap üretilmez")

    doc = None
    if candidate:
        doc = await db.sites.find_one({"domains": candidate, "active": True})
    if doc is None:
        raise HTTPException(status_code=404, detail="Bu domain için yayında site yok")

    base = f"https://{candidate}"
    updated = (doc.get("created_at") or now_tz())
    lastmod = updated.strftime("%Y-%m-%d") if hasattr(updated, "strftime") else str(updated)[:10]
    urls = "".join(
        f"<url><loc>{base}{path}</loc><lastmod>{lastmod}</lastmod>"
        f"<changefreq>daily</changefreq><priority>{priority}</priority></url>"
        for path, priority in (("/", "1.0"),)
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{urls}</urlset>"
    )
    return Response(content=xml, media_type="application/xml")


@router.post("/slots/{slot_id}/click")
async def track_click(slot_id: str):
    doc = await db.ad_slots.find_one({"id": slot_id}, {"site_id": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Reklam alanı bulunamadı")
    await db.ad_slots.update_one({"id": slot_id}, {"$inc": {"clicks": 1}})
    # Günlük grafik için olay kaydı (gün, sunucu saatiyle sabitlenir)
    now = now_tz()
    await db.click_events.insert_one(
        {
            "slot_id": slot_id,
            "site_id": doc["site_id"],
            "day": now.strftime("%Y-%m-%d"),
            "created_at": now,
        }
    )
    return {"ok": True}
