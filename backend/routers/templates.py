"""Varsayılan tasarım şablonları: bir sitenin tasarımını isimlendirip saklar ve
o tasarımla yeni site oluşturur. Şablon, siteden bağımsız bir kopyadır — kaynak site
sonradan değişse bile şablon aynı kalır."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.db import db
from models.schemas import (
    AdSlot,
    DesignTemplate,
    DesignTemplateCreate,
    DesignTemplateRefresh,
    DesignTemplateSnapshot,
    DesignTemplateUpdate,
    Site,
    TemplateSiteCreate,
)
from routers.auth import require_admin

router = APIRouter(prefix="/templates", tags=["templates"], dependencies=[Depends(require_admin)])

# Şablona alınan tasarım alanları (domain/slug/isim gibi kimlik alanları HARİÇ).
DESIGN_FIELDS = (
    "title",
    "tagline",
    "logo_text",
    "hero_image_url",
    "marquee",
    "columns",
    "theme",
    "popup",
    "custom_css",
)


def _snapshot_from_site(doc: dict, slots: List[dict]) -> DesignTemplateSnapshot:
    data = {f: doc[f] for f in DESIGN_FIELDS if f in doc}
    data["slots"] = [
        {k: v for k, v in s.items() if k not in {"_id", "id", "site_id", "created_at", "clicks"}}
        for s in slots
    ]
    return DesignTemplateSnapshot(**data)


@router.get("", response_model=List[DesignTemplate])
async def list_templates():
    docs = await db.design_templates.find().sort("created_at", 1).to_list(200)
    return [DesignTemplate(**d) for d in docs]


@router.post("", response_model=DesignTemplate, status_code=201)
async def create_template(payload: DesignTemplateCreate):
    """Mevcut bir sitenin tasarımını şablon olarak kaydeder."""
    site = await db.sites.find_one({"id": payload.source_site_id})
    if not site:
        raise HTTPException(status_code=404, detail="Kaynak site bulunamadı")
    name = payload.name.strip()
    if await db.design_templates.find_one({"name": name}):
        raise HTTPException(status_code=409, detail="Bu isimde bir şablon zaten var")

    slots = await db.ad_slots.find({"site_id": site["id"]}).sort("order", 1).to_list(500)
    snapshot = _snapshot_from_site(site, slots if payload.include_slots else [])
    template = DesignTemplate(
        name=name,
        description=payload.description.strip(),
        source_site_slug=site.get("slug", ""),
        preview_image_url=payload.preview_image_url or site.get("hero_image_url", ""),
        snapshot=snapshot,
    )
    await db.design_templates.insert_one(template.model_dump())
    return template


@router.get("/{template_id}", response_model=DesignTemplate)
async def get_template(template_id: str):
    doc = await db.design_templates.find_one({"id": template_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    return DesignTemplate(**doc)


@router.put("/{template_id}", response_model=DesignTemplate)
async def update_template(template_id: str, payload: DesignTemplateUpdate):
    doc = await db.design_templates.find_one({"id": template_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    changes = payload.model_dump(exclude_none=True)
    if "name" in changes:
        changes["name"] = changes["name"].strip()
        clash = await db.design_templates.find_one(
            {"name": changes["name"], "id": {"$ne": template_id}}
        )
        if clash:
            raise HTTPException(status_code=409, detail="Bu isimde bir şablon zaten var")
    if changes:
        await db.design_templates.update_one({"id": template_id}, {"$set": changes})
        doc = await db.design_templates.find_one({"id": template_id})
    return DesignTemplate(**doc)  # type: ignore[arg-type]


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    res = await db.design_templates.delete_one({"id": template_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    return {"ok": True}


@router.post("/{template_id}/refresh", response_model=DesignTemplate)
async def refresh_template(template_id: str, payload: DesignTemplateRefresh):
    """'Şablonu güncelle': seçilen sitenin GÜNCEL tasarımını şablonun üzerine yazar."""
    doc = await db.design_templates.find_one({"id": template_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    site = await db.sites.find_one({"id": payload.source_site_id})
    if not site:
        raise HTTPException(status_code=404, detail="Kaynak site bulunamadı")

    slots = await db.ad_slots.find({"site_id": site["id"]}).sort("order", 1).to_list(500)
    snapshot = _snapshot_from_site(site, slots if payload.include_slots else [])
    await db.design_templates.update_one(
        {"id": template_id},
        {
            "$set": {
                "snapshot": snapshot.model_dump(),
                "source_site_slug": site.get("slug", ""),
                "preview_image_url": site.get("hero_image_url", "") or doc.get(
                    "preview_image_url", ""
                ),
            }
        },
    )
    fresh = await db.design_templates.find_one({"id": template_id})
    return DesignTemplate(**fresh)  # type: ignore[arg-type]


@router.post("/{template_id}/create-site", response_model=Site, status_code=201)
async def create_site_from_template(template_id: str, payload: TemplateSiteCreate):
    """'Bu tasarımla site oluştur': şablonu yeni bir siteye uygular."""
    doc = await db.design_templates.find_one({"id": template_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    slug = payload.slug.strip().lower()
    if not slug:
        raise HTTPException(status_code=422, detail="Slug gerekli")
    if await db.sites.find_one({"slug": slug}):
        raise HTTPException(status_code=409, detail="Bu slug zaten kullanımda")

    template = DesignTemplate(**doc)
    snapshot = template.snapshot.model_dump()
    slots = snapshot.pop("slots", [])
    site = Site(
        **snapshot,
        slug=slug,
        name=payload.name.strip() or slug,
        domains=[d.strip().lower().removeprefix("www.") for d in payload.domains if d.strip()],
    )
    await db.sites.insert_one(site.model_dump())

    if payload.include_slots:
        for slot in slots:
            await db.ad_slots.insert_one(AdSlot(**{**slot, "site_id": site.id}).model_dump())

    await db.design_templates.update_one(
        {"id": template_id}, {"$inc": {"used_count": 1}}
    )
    return site
