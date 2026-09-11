"""Public visitor API — resolves the active site by Host header or ?slug= preview."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from lib.db import db
from models.schemas import AdSlot, PublicSite, Site

router = APIRouter(prefix="/public", tags=["public"])


def _normalize(host: str) -> str:
    return host.split(":")[0].strip().lower().removeprefix("www.")


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
    res = await db.ad_slots.update_one({"id": slot_id}, {"$inc": {"clicks": 1}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reklam alanı bulunamadı")
    return {"ok": True}
