"""Idempotent seed: demo admin + three sites with ad slots. Run: cd /app/backend && python seed.py"""

import asyncio

from lib.db import db, ensure_indexes
from models.schemas import AdSlot, Popup, Site, Theme
from routers.auth import ensure_default_admin

HERO = "https://images.unsplash.com/photo-1511965897574-f6fc86cf3474?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600"
SLOT_MACHINE = "https://images.unsplash.com/photo-1604028296525-8304e1a4969f?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"
ROULETTE = "https://images.unsplash.com/photo-1627831389670-d20f5a01c536?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"
STADIUM = "https://images.unsplash.com/photo-1522778119026-d647f0596c20?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"
CROWD = "https://images.unsplash.com/photo-1599158150601-1417ebbaafdd?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"


SITES = [
    {
        "slug": "tuna40",
        "name": "Tuna40 Portal",
        "domains": ["tuna40.com", "tuna40giris.com"],
        "title": "TUNA40 GÜNCEL GİRİŞ",
        "tagline": "Güvenilir bahis ve casino adreslerinin güncel giriş merkezi",
        "logo_text": "TUNA40",
        "hero_image_url": HERO,
        "marquee": [
            "Güncel giriş adresleri 7/24 güncellenir",
            "Yeni üyelere %200 hoş geldin bonusu",
            "Anında para çekim garantisi",
        ],
        "columns": 4,
        "theme": Theme().model_dump(),
        "popup": Popup(
            title="TUNA40 VIP BONUS",
            subtitle="Sadece bugüne özel %200 hoş geldin bonusu ve 100 free spin.",
            image_url=ROULETTE,
            cta_text="HEMEN KATIL",
            cta_url="https://example.com/kayit",
            countdown_seconds=90,
        ).model_dump(),
        "slots": [
            ("image", "MEGA JACKPOT", "SPONSOR", SLOT_MACHINE, 2, 280),
            ("image", "CANLI CASINO", "YENİ", ROULETTE, 1, 280),
            ("image", "SPOR BAHİS", "POPÜLER", STADIUM, 1, 280),
            ("cta", "%200 HOŞ GELDİN BONUSU", "BONUS", "", 2, 220),
            ("image", "VIP TURNUVA", "VIP", CROWD, 1, 220),
            ("html", "SPONSOR ALANI", "REKLAM", "", 1, 220),
        ],
    },
    {
        "slug": "deniz23",
        "name": "Deniz23 Bet",
        "domains": ["deniz23.com"],
        "title": "DENİZ23 BAHİS MERKEZİ",
        "tagline": "Yüksek oranlar, hızlı ödeme, kesintisiz giriş",
        "logo_text": "DENİZ23",
        "hero_image_url": STADIUM,
        "marquee": ["Canlı maç oranları", "Kayıp bonusu %25", "Papara & Havale ile anında yatırım"],
        "columns": 3,
        "theme": Theme(accent="#06B6D4", accent2="#F43F5E").model_dump(),
        "popup": Popup(
            title="DENİZ23 ÖZEL FIRSAT",
            subtitle="İlk yatırımına özel 1000 TL çevrimsiz deneme bonusu.",
            image_url=CROWD,
            cta_text="BONUSU KAP",
            cta_url="https://example.com/bonus",
            countdown_seconds=60,
        ).model_dump(),
        "slots": [
            ("image", "GÜNÜN MAÇI", "CANLI", STADIUM, 2, 260),
            ("cta", "ÇEVRİMSİZ 1000 TL", "DENEME", "", 1, 260),
            ("image", "SLOT OYUNLARI", "SICAK", SLOT_MACHINE, 1, 220),
            ("image", "RULET SALONU", "", ROULETTE, 2, 220),
        ],
    },
    {
        "slug": "vipbonus",
        "name": "VIP Bonus Merkezi",
        "domains": ["vipbonusmerkezi.com"],
        "title": "VIP BONUS MERKEZİ",
        "tagline": "Tüm güncel bonus kampanyaları tek adreste",
        "logo_text": "VIP BONUS",
        "hero_image_url": CROWD,
        "marquee": ["Günlük bonus listesi", "Editör onaylı siteler"],
        "columns": 2,
        "theme": Theme(accent="#A3E635", accent2="#22D3EE").model_dump(),
        "popup": Popup(enabled=False).model_dump(),
        "slots": [
            ("image", "HAFTANIN BONUSU", "EDİTÖR", ROULETTE, 1, 240),
            ("cta", "ÜCRETSİZ DENEME BONUSU", "YENİ", "", 1, 240),
        ],
    },
]


async def main() -> None:
    await db.sites.delete_many({})
    await db.ad_slots.delete_many({})
    await ensure_indexes()
    await ensure_default_admin()

    for entry in SITES:
        slots = entry.pop("slots")
        site = Site(**entry)
        await db.sites.insert_one(site.model_dump())
        for i, (stype, title, badge, image, span, height) in enumerate(slots):
            slot = AdSlot(
                site_id=site.id,
                type=stype,
                title=title,
                badge=badge,
                image_url=image,
                target_url="https://example.com/git",
                description="Güncel giriş adresi için tıklayın, kesintisiz erişim sizi bekliyor.",
                cta_text="HEMEN AL",
                html='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#F59E0B;font-weight:700;letter-spacing:2px">REKLAM ALANI 300x250</div>',
                col_span=span,
                height=height,
                order=i,
            )
            await db.ad_slots.insert_one(slot.model_dump())
        print(f"seeded {site.slug} with {len(slots)} slots")

    print("admin / admin123")


if __name__ == "__main__":
    asyncio.run(main())
