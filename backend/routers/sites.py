"""Backoffice CRUD for sites (domains/theme/popup) and their ad slots. Auth required."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel

from lib.db import db
from models.schemas import (
    AdSlot,
    AdSlotCreate,
    AdSlotUpdate,
    Site,
    SiteCreate,
    SiteUpdate,
)
from routers.auth import require_admin


class ReorderRequest(BaseModel):
    ids: List[str]


class DuplicateRequest(BaseModel):
    slug: str
    name: str
    domains: List[str] = []

router = APIRouter(prefix="/sites", tags=["sites"], dependencies=[Depends(require_admin)])


@router.get("", response_model=List[Site])
async def list_sites():
    docs = await db.sites.find().sort("created_at", 1).to_list(500)
    return [Site(**d) for d in docs]


@router.post("", response_model=Site, status_code=201)
async def create_site(payload: SiteCreate):
    if await db.sites.find_one({"slug": payload.slug}):
        raise HTTPException(status_code=409, detail="Bu slug zaten kullanımda")
    site = Site(**payload.model_dump())
    await db.sites.insert_one(site.model_dump())
    return site


@router.get("/{site_id}", response_model=Site)
async def get_site(site_id: str):
    doc = await db.sites.find_one({"id": site_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Site bulunamadı")
    return Site(**doc)


@router.put("/{site_id}", response_model=Site)
async def update_site(site_id: str, payload: SiteUpdate):
    doc = await db.sites.find_one({"id": site_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Site bulunamadı")
    changes = payload.model_dump(exclude_none=True)
    if changes:
        await db.sites.update_one({"id": site_id}, {"$set": changes})
        doc = await db.sites.find_one({"id": site_id})
    return Site(**doc)  # type: ignore[arg-type]


@router.delete("/{site_id}")
async def delete_site(site_id: str):
    res = await db.sites.delete_one({"id": site_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Site bulunamadı")
    await db.ad_slots.delete_many({"site_id": site_id})
    return {"ok": True}


@router.post("/{site_id}/duplicate", response_model=Site, status_code=201)
async def duplicate_site(site_id: str, payload: DuplicateRequest):
    """Tüm tasarım, pop-up kolonları ve reklam kartlarını yeni bir siteye kopyalar."""
    source = await db.sites.find_one({"id": site_id})
    if not source:
        raise HTTPException(status_code=404, detail="Kaynak site bulunamadı")
    if await db.sites.find_one({"slug": payload.slug}):
        raise HTTPException(status_code=409, detail="Bu slug zaten kullanımda")

    data = {k: v for k, v in source.items() if k not in {"_id", "id", "created_at"}}
    data["slug"] = payload.slug
    data["name"] = payload.name
    data["domains"] = [d.lower().removeprefix("www.") for d in payload.domains]
    clone = Site(**data)
    await db.sites.insert_one(clone.model_dump())

    slots = await db.ad_slots.find({"site_id": site_id}).sort("order", 1).to_list(500)
    for doc in slots:
        slot_data = {k: v for k, v in doc.items() if k not in {"_id", "id", "created_at", "clicks"}}
        slot_data["site_id"] = clone.id
        await db.ad_slots.insert_one(AdSlot(**slot_data).model_dump())
    return clone


# ---- ad slots ----


@router.get("/{site_id}/slots", response_model=List[AdSlot])
async def list_slots(site_id: str):
    docs = await db.ad_slots.find({"site_id": site_id}).sort("order", 1).to_list(500)
    return [AdSlot(**d) for d in docs]


@router.post("/{site_id}/slots", response_model=AdSlot, status_code=201)
async def create_slot(site_id: str, payload: AdSlotCreate):
    if not await db.sites.find_one({"id": site_id}):
        raise HTTPException(status_code=404, detail="Site bulunamadı")
    slot = AdSlot(**{**payload.model_dump(), "site_id": site_id})
    await db.ad_slots.insert_one(slot.model_dump())
    return slot


@router.post("/{site_id}/slots/reorder", response_model=List[AdSlot])
async def reorder_slots(site_id: str, payload: ReorderRequest):
    """Sürükle-bırak sıralaması: gönderilen id dizisi yeni sırayı belirler."""
    for index, slot_id in enumerate(payload.ids):
        await db.ad_slots.update_one({"id": slot_id, "site_id": site_id}, {"$set": {"order": index}})
    docs = await db.ad_slots.find({"site_id": site_id}).sort("order", 1).to_list(500)
    return [AdSlot(**d) for d in docs]


@router.put("/{site_id}/slots/{slot_id}", response_model=AdSlot)
async def update_slot(site_id: str, slot_id: str, payload: AdSlotUpdate):
    doc = await db.ad_slots.find_one({"id": slot_id, "site_id": site_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Reklam alanı bulunamadı")
    changes = payload.model_dump(exclude_none=True)
    if changes:
        await db.ad_slots.update_one({"id": slot_id}, {"$set": changes})
        doc = await db.ad_slots.find_one({"id": slot_id})
    return AdSlot(**doc)  # type: ignore[arg-type]


@router.delete("/{site_id}/slots/{slot_id}")
async def delete_slot(site_id: str, slot_id: str):
    res = await db.ad_slots.delete_one({"id": slot_id, "site_id": site_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reklam alanı bulunamadı")
    return {"ok": True}
