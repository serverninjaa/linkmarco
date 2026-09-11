"""Public visitor API — resolves the active site by Host header or ?slug= preview."""

import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
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
    if slug:
        doc = await db.sites.find_one({"slug": slug, "active": True})
    if doc is None:
        candidate = _normalize(host or request.headers.get("host", ""))
        if candidate:
            doc = await db.sites.find_one({"domains": candidate, "active": True})
    if doc is None:
        doc = await db.sites.find_one({"active": True})
    if doc is None:
        raise HTTPException(status_code=404, detail="Yayında site yok")
    site = Site(**doc)
    slot_docs = (
        await db.ad_slots.find({"site_id": site.id, "active": True}).sort("order", 1).to_list(500)
    )
    return PublicSite(site=site, slots=[AdSlot(**s) for s in slot_docs])


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
