"""Backoffice CRUD for sites (domains/theme/popup) and their ad slots. Auth required."""

import asyncio
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel

from lib.dates import now_tz, recent_days
from lib.db import db
from models.schemas import (
    AdSlot,
    AdSlotCreate,
    AdSlotUpdate,
    DailyPoint,
    LinkCheckResult,
    LinkCheckSummary,
    Site,
    SiteCreate,
    SiteStats,
    SiteUpdate,
    SlotStat,
)
from routers.auth import require_admin


class ReorderRequest(BaseModel):
    ids: List[str]


class DuplicateRequest(BaseModel):
    slug: str
    name: str
    domains: List[str] = []

def _slot_label(doc: dict) -> str:
    """Panel/istatistik etiketi: logolu kartlarda başlık boş olabildiği için sıralı fallback."""
    host = ""
    url = (doc.get("target_url") or "").strip()
    if url:
        host = url.split("//")[-1].split("/")[0].replace("www.", "")
    return doc.get("title") or doc.get("badge") or doc.get("description") or host or "(kart)"


router = APIRouter(prefix="/sites", tags=["sites"], dependencies=[Depends(require_admin)])


@router.get("", response_model=List[Site])
async def list_sites():
    docs = await db.sites.find().sort("created_at", 1).to_list(500)
    return [Site(**d) for d in docs]


@router.post("", response_model=Site, status_code=201)
async def create_site(payload: SiteCreate):
    if await db.sites.find_one({"slug": payload.slug}):
        raise HTTPException(status_code=409, detail="Bu slug zaten kullanımda")
    data = payload.model_dump()
    # Varsayılan tasarım şablonu varsa yeni site onun görünümünü devralır
    # (tema, kolon sayısı, özel CSS ve pop-up ayarları — reklam kartları hariç).
    template = await db.sites.find_one({"is_default": True})
    if template:
        data["theme"] = template["theme"]
        data["columns"] = template["columns"]
        data["custom_css"] = template.get("custom_css", "")
        popup = dict(template["popup"])
        popup["items"] = []  # kampanya kolonları kopyalanmaz, tasarım devralınır
        data["popup"] = popup
    site = Site(**data)
    await db.sites.insert_one(site.model_dump())
    return site


@router.post("/{site_id}/set-default", response_model=Site)
async def set_default_site(site_id: str):
    """Bu sitenin tasarımını varsayılan şablon yapar (tek seferde bir site)."""
    doc = await db.sites.find_one({"id": site_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Site bulunamadı")
    await db.sites.update_many({"is_default": True}, {"$set": {"is_default": False}})
    await db.sites.update_one({"id": site_id}, {"$set": {"is_default": True}})
    doc = await db.sites.find_one({"id": site_id})
    return Site(**doc)  # type: ignore[arg-type]


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
        # Tasarım kaydedildikten sonra Cloudflare önbelleğini sessizce boşalt (panelden kapatılabilir).
        from routers.cloudflare import purge_site_cache

        asyncio.create_task(purge_site_cache(site_id))
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
    data["is_default"] = False  # kopya varsayılan şablon olmaz
    data["domains"] = [d.lower().removeprefix("www.") for d in payload.domains]
    clone = Site(**data)
    await db.sites.insert_one(clone.model_dump())

    slots = await db.ad_slots.find({"site_id": site_id}).sort("order", 1).to_list(500)
    for doc in slots:
        slot_data = {k: v for k, v in doc.items() if k not in {"_id", "id", "created_at", "clicks"}}
        slot_data["site_id"] = clone.id
        await db.ad_slots.insert_one(AdSlot(**slot_data).model_dump())
    return clone


@router.post("/{site_id}/slots/check-links", response_model=LinkCheckSummary)
async def check_links(site_id: str):
    """Her kartın hedef linkini izler: ölü veya bozuk yönlendirmeleri işaretler."""
    slots = await db.ad_slots.find({"site_id": site_id}).sort("order", 1).to_list(500)
    if not slots:
        return LinkCheckSummary(checked=0, ok=0, problems=0, results=[])

    results: list[LinkCheckResult] = []
    headers = {"User-Agent": "Mozilla/5.0 (compatible; AdCoreLinkCheck/1.0)"}
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=12) as client:

        async def probe(doc: dict) -> LinkCheckResult:
            url = (doc.get("target_url") or "").strip()
            status: str = "unknown"
            code = 0
            final = ""
            if url:
                try:
                    res = await client.get(url)
                    code = res.status_code
                    final = str(res.url)
                    # 403/405/406/429: sunucu ayakta, sadece bot trafiğini engelliyor (Cloudflare
                    # vb.) — bunlar ölü link DEĞİL, yanlış alarm vermemek için "ok" sayılır.
                    if code in (403, 405, 406, 429):
                        status = "ok"
                    elif code in (404, 410) or code >= 500:
                        status = "dead"
                    elif code >= 400:
                        status = "broken"
                    else:
                        status = "ok"
                except Exception:
                    status = "dead"
            await db.ad_slots.update_one(
                {"id": doc["id"]},
                {
                    "$set": {
                        "link_status": status,
                        "link_http_status": code,
                        "link_final_url": final,
                        "link_checked_at": now_tz(),
                    }
                },
            )
            return LinkCheckResult(
                slot_id=doc["id"],
                title=_slot_label(doc),
                target_url=url,
                link_status=status,  # type: ignore[arg-type]
                link_http_status=code,
                link_final_url=final,
            )

        results = list(await asyncio.gather(*(probe(d) for d in slots)))

    ok = sum(1 for r in results if r.link_status == "ok")
    return LinkCheckSummary(
        checked=len(results), ok=ok, problems=len(results) - ok, results=results
    )


@router.get("/{site_id}/stats", response_model=SiteStats)
async def site_stats(site_id: str, days: int = 7):
    """Günlük tıklama grafiği + sponsor bazlı toplamlar (sunucu tarihine göre)."""
    days = max(1, min(days, 90))
    window = recent_days(days)
    slots = await db.ad_slots.find({"site_id": site_id}).sort("order", 1).to_list(500)

    events = await db.click_events.find(
        {"site_id": site_id, "day": {"$in": window}}, {"slot_id": 1, "day": 1}
    ).to_list(200000)

    by_day: dict[str, int] = {d: 0 for d in window}
    by_slot_day: dict[str, dict[str, int]] = {s["id"]: {d: 0 for d in window} for s in slots}
    for ev in events:
        if ev["day"] in by_day:
            by_day[ev["day"]] += 1
        slot_days = by_slot_day.get(ev["slot_id"])
        if slot_days is not None and ev["day"] in slot_days:
            slot_days[ev["day"]] += 1

    slot_stats = [
        SlotStat(
            slot_id=s["id"],
            title=_slot_label(s),
            badge=s.get("badge", ""),
            border_color=s.get("border_color", "#22C55E"),
            clicks_total=int(s.get("clicks", 0)),
            clicks_range=sum(by_slot_day.get(s["id"], {}).values()),
        )
        for s in slots
    ]
    slot_stats.sort(key=lambda s: (s.clicks_range, s.clicks_total), reverse=True)

    return SiteStats(
        days=days,
        total_clicks=sum(int(s.get("clicks", 0)) for s in slots),
        range_clicks=sum(by_day.values()),
        daily=[DailyPoint(day=d, clicks=by_day[d]) for d in window],
        slots=slot_stats,
        per_slot_daily={
            sid: [DailyPoint(day=d, clicks=counts[d]) for d in window]
            for sid, counts in by_slot_day.items()
        },
    )


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
