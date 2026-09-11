"""Idempotent seed: demo admin + three sites with marco-style brand cards and columned pop-up ads.

Run: cd /app/backend && python seed.py
"""

import asyncio

from lib.db import db, ensure_indexes
from models.schemas import AdSlot, Popup, PopupItem, Site, Theme
from routers.auth import ensure_default_admin

HERO = "https://images.unsplash.com/photo-1511965897574-f6fc86cf3474?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600"
STADIUM = "https://images.unsplash.com/photo-1522778119026-d647f0596c20?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600"
CROWD = "https://images.unsplash.com/photo-1599158150601-1417ebbaafdd?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600"

GREEN, YELLOW, ORANGE, PURPLE, RED, CYAN, PINK, LIME = (
    "#22C55E",
    "#FACC15",
    "#F97316",
    "#A855F7",
    "#EF4444",
    "#06B6D4",
    "#EC4899",
    "#84CC16",
)


def popup_items(rows):
    return [
        PopupItem(
            brand_name=b,
            line1=l1,
            line2=l2,
            url="https://example.com/git",
            border_color=color,
            col_span=span,
            order=i,
        ).model_dump()
        for i, (b, l1, l2, color, span) in enumerate(rows)
    ]


SITES = [
    {
        "slug": "marco",
        "name": "Marco Portal",
        "domains": ["marco.com", "marcogiris.com"],
        "title": "MARCO GÜNCEL GİRİŞ ADRESLERİ",
        "tagline": "Güvenilir bahis ve casino adreslerinin güncel giriş merkezi",
        "logo_text": "MARCO",
        "hero_image_url": HERO,
        "marquee": [
            "Güncel giriş adresleri 7/24 güncellenir",
            "Yeni üyelere %200 hoş geldin bonusu",
            "Anında para çekim garantisi",
        ],
        "columns": 3,
        "theme": Theme(
            bg="#090B10", panel="#0A0C12", card="#0D1017", accent=GREEN, accent2=YELLOW, text="#F1F5F9"
        ).model_dump(),
        "popup": Popup(
            enabled=True,
            title="MARCO — GÜNÜN EN İYİ BONUS ADRESLERİ",
            subtitle="Aşağıdaki markalardan birini seçerek anında üye olabilirsiniz",
            columns=3,
            items=popup_items(
                [
                    ("ETOBAHİS", "1.000₺ - 5.000₺ NAKİT BONUS!", "%30'A VARAN KAYIP BONUSU!", GREEN, 3),
                    ("HERKULBET", "500₺ DENEME BONUSU", "250₺ MİN. YATIRIM", GREEN, 1),
                    ("JOJOBET", "TÜRKİYE'NİN MARKASI", "%10 ANLIK DISCOUNT", YELLOW, 1),
                    ("STARZBET", "HER GÜN DENEME BONUSU", "1.000₺ NAKİT", ORANGE, 1),
                    ("MATBET", "5.000₺'E KADAR NAKİT BONUS!", "", PURPLE, 1),
                    ("PRADABET", "YENİ ÜYELERE 500TL DENEME", "", RED, 1),
                    ("JONIBET", "12.000₺ NAKİT HOŞGELDİN", "%30 ANLIK KAYIP", GREEN, 1),
                    ("BETNANO", "200% SPOR HOŞGELDİN", "30% KRİPTO BONUSU", YELLOW, 3),
                ]
            ),
        ).model_dump(),
        "slots": [
            ("image", "ETOBAHİS", "1. SIRA", "1.000₺ - 5.000₺ NAKİT BONUS", "%30'A VARAN KAYIP BONUSU", GREEN, 3, 150),
            ("image", "HERKULBET", "", "500₺ DENEME BONUSU", "250₺ MİN. YATIRIM", GREEN, 1, 150),
            ("image", "JOJOBET", "", "TÜRKİYE'NİN MARKASI", "%10 ANLIK DISCOUNT", YELLOW, 1, 150),
            ("image", "STARZBET", "", "HER GÜN DENEME BONUSU", "1.000₺ NAKİT", ORANGE, 1, 150),
            ("image", "MATBET", "", "5.000₺'E KADAR NAKİT BONUS", "ANINDA ÇEKİM", PURPLE, 1, 150),
            ("image", "PRADABET", "", "YENİ ÜYELERE 500TL DENEME", "ÇEVRİMSİZ", RED, 1, 150),
            ("image", "JONIBET", "", "12.000₺ NAKİT HOŞGELDİN", "%30 ANLIK KAYIP", CYAN, 1, 150),
            ("cta", "BETNANO", "SPONSOR", "200% SPOR HOŞGELDİN BONUSU", "30% KRİPTO BONUSU", YELLOW, 3, 150),
            ("image", "CASİBOM", "", "%100 İLK YATIRIM", "500 FREE SPIN", PINK, 1, 150),
            ("image", "BAHSEGEL", "", "750₺ DENEME BONUSU", "ANINDA HESAP", LIME, 1, 150),
            ("image", "TIPOBET", "", "%50 CANLI CASINO", "7/24 DESTEK", GREEN, 1, 150),
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
        "columns": 2,
        "theme": Theme(
            bg="#05070E", panel="#080B14", card="#0B0F19", accent=CYAN, accent2=PINK, text="#F1F5F9"
        ).model_dump(),
        "popup": Popup(
            enabled=True,
            title="DENİZ23 ÖZEL BONUS ADRESLERİ",
            subtitle="Editör onaylı güncel bahis siteleri",
            columns=2,
            items=popup_items(
                [
                    ("DENİZBET", "1000₺ ÇEVRİMSİZ DENEME", "ANINDA ÇEKİM", CYAN, 2),
                    ("MARINABET", "%200 HOŞGELDİN", "500 FREE SPIN", PINK, 1),
                    ("OCEANBAHİS", "HER GÜN KAYIP BONUSU", "%40 SPOR", GREEN, 1),
                ]
            ),
        ).model_dump(),
        "slots": [
            ("image", "DENİZBET", "EDİTÖR", "1000₺ ÇEVRİMSİZ DENEME", "ANINDA ÇEKİM", CYAN, 2, 160),
            ("image", "MARINABET", "", "%200 HOŞGELDİN BONUSU", "500 FREE SPIN", PINK, 1, 150),
            ("image", "OCEANBAHİS", "", "HER GÜN KAYIP BONUSU", "%40 SPOR BONUSU", GREEN, 1, 150),
            ("cta", "VIP ÜYELİK", "VIP", "ÖZEL ORANLAR VE LİMİTLER", "KİŞİSEL HESAP YÖNETİCİSİ", YELLOW, 2, 150),
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
        "theme": Theme(
            bg="#0A0A0F", panel="#0D0D14", card="#12121A", accent=LIME, accent2=CYAN, text="#F1F5F9"
        ).model_dump(),
        "popup": Popup(enabled=False, columns=2, items=[]).model_dump(),
        "slots": [
            ("image", "HAFTANIN BONUSU", "EDİTÖR", "5.000₺ NAKİT ÖDÜL", "ÇEVRİMSİZ", LIME, 1, 150),
            ("cta", "ÜCRETSİZ DENEME", "YENİ", "YATIRIMSIZ 250₺ BONUS", "SADECE YENİ ÜYELER", CYAN, 1, 150),
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
        for i, (stype, title, badge, line1, line2, color, span, height) in enumerate(slots):
            slot = AdSlot(
                site_id=site.id,
                type=stype,
                title=title,
                badge=badge,
                # Geniş kartlarda orta üst, tek kolonlarda sol üst — panelden değiştirilebilir.
                badge_position="center" if span >= 2 else "left",
                # Demo: geniş kartlarda şerit, tek kolonlarda köşe rozeti
                badge_style="strip" if span >= 3 else ("ribbon" if span == 2 else "corner"),
                description=line1,
                line2=line2,
                target_url="https://example.com/git",
                cta_text="HEMEN ÜYE OL",
                html='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#22C55E;font-weight:700;letter-spacing:2px">REKLAM ALANI 300x250</div>',
                border_color=color,
                col_span=span,
                height=height,
                order=i,
            )
            await db.ad_slots.insert_one(slot.model_dump())
        print(f"seeded {site.slug}: {len(slots)} kart, {len(site.popup.items)} pop-up kolonu")

    print("admin / admin123")


if __name__ == "__main__":
    asyncio.run(main())
