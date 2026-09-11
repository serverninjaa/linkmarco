"""deniz25.com pop-up sponsorlarını Marco sitesine aktarır.

Logolar hotlink edilmez: indirilip `uploads` koleksiyonuna kaydedilir ve
`/api/uploads/<id>` olarak servis edilir. Idempotent — tekrar çalıştırılabilir.

Çalıştırma: cd /app/backend && python import_deniz25.py
"""

import asyncio
import uuid
from datetime import datetime, timezone

import httpx

from lib.db import db
from models.schemas import AdSlot, PopupItem

SRC = "https://deniz25.com"

# (marka, link, logo_url, 1.satır, 2.satır, neon renk, pop-up kolon, kart kolon)
# Logo yolları HAM kaynak dosyalardır: /_next/image optimizasyon servisi 0 byte dönebiliyor.
SPONSORS = [
    ("ETOBAHİS", "https://etobahis259.com?ref=deniz500",
     f"{SRC}/logos/etobahis.webp",
     "1.000₺ - 5.000₺ NAKİT BONUS!", "%30'A VARAN KAYIP BONUSU!", "#22C55E", 3, 3),
    ("HERKULBET", "https://t2m.co/marcoherkul",
     f"{SRC}/api/media/uploads/1783582684279-73db765b-9a1f-4874-b5f3-fd21436e6d75.png",
     "500₺ DENEME BONUSU", "250₺ MİN. YATIRIM", "#22C55E", 1, 1),
    ("JOJOBET", "https://dub.is/jojomarco",
     f"{SRC}/logos/jojobet.webp",
     "TÜRKİYE'NİN MARKASI", "10% ANLIK DISCOUNT", "#FACC15", 1, 1),
    ("STARZBET", "https://strz.cc/qQhZ",
     f"{SRC}/logos/starzbet.webp",
     "HER GÜN DENEME BONUSU", "1.000₺ NAKİT", "#F97316", 1, 1),
    ("MATBET", "https://dub.is/marco",
     f"{SRC}/logos/matbet.webp",
     "5.000₺'E KADAR NAKİT BONUS!", "%100 KRİPTO YATIRIM BONUSU", "#A855F7", 1, 1),
    ("PRADABET", "https://pradabet.short.gy/marco",
     f"{SRC}/logos/pradabet.webp",
     "YENİ ÜYELERE 500TL DENEME", "SINIRSIZ ANLIK ÇEKİM!", "#EF4444", 1, 1),
    ("JONİBET", "https://kisabirl.ink/dayko",
     f"{SRC}/api/media/sites/1783085127970-dde96de5-8b5e-4c25-bb15-6e333263fea5.png",
     "12.000₺ NAKİT HOŞGELDİN", "%30 ANLIK KAYIP", "#06B6D4", 1, 1),
    ("BETNANO", "https://nanogiris.direct/YtMarcoDayko",
     f"{SRC}/logos/betnano.webp",
     "%200 HOŞGELDİN SPOR BONUSU", "%30 KRİPTO KAYIP BONUSU", "#FACC15", 3, 3),
    # Pop-up dışındaki ana grid sponsorları — sadece reklam kartı olarak eklenir
    ("STAKE", "https://dub.sh/stakeguncelgiris", f"{SRC}/logos/stake.svg",
     "21$ + 21$ = $42,00", "2.000₺ NAKİT ÜYE OL AL!", "#EC4899", 0, 1),
    ("BETMANİ", "https://manigir.s.gy/marcomani",
     f"{SRC}/logos/betmani.webp",
     "İLK YATIRIMA %50 NAKİT İADE", "%30 KAYIP BONUSU", "#84CC16", 0, 1),
]


async def store_logo(client: httpx.AsyncClient, brand: str, url: str) -> str:
    """Logoyu indirip uploads koleksiyonuna yazar, /api/uploads/<id> döner."""
    existing = await db.uploads.find_one({"source_url": url})
    if existing and len(existing.get("data", b"")) > 200:
        return f"/api/uploads/{existing['id']}"
    try:
        res = await client.get(url, timeout=30, follow_redirects=True)
        res.raise_for_status()
    except Exception as exc:
        print(f"  ! {brand}: logo indirilemedi ({exc}) — marka adı yazıyla gösterilecek")
        return ""
    if len(res.content) < 200:  # boş/placeholder yanıt
        print(f"  ! {brand}: boş logo yanıtı ({len(res.content)} byte) — atlandı")
        return ""
    ctype = res.headers.get("content-type", "image/png").split(";")[0]
    upload_id = str(uuid.uuid4())
    await db.uploads.insert_one(
        {
            "id": upload_id,
            "content_type": ctype,
            "filename": f"{brand.lower()}.{ctype.split('/')[-1]}",
            "data": res.content,
            "source_url": url,
            "created_at": datetime.now(timezone.utc),
        }
    )
    print(f"  + {brand}: {len(res.content) // 1024} KB ({ctype})")
    return f"/api/uploads/{upload_id}"


async def main() -> None:
    site = await db.sites.find_one({"slug": "marco"})
    if not site:
        raise SystemExit("marco sitesi bulunamadı — önce python seed.py çalıştırın")

    print("Logolar indiriliyor...")
    logos: dict[str, str] = {}
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0", "Referer": SRC}) as client:
        for brand, _link, logo_url, *_rest in SPONSORS:
            logos[brand] = await store_logo(client, brand, logo_url)

    # --- Pop-up kolonları
    items = []
    order = 0
    for brand, link, _u, line1, line2, color, popup_span, _card_span in SPONSORS:
        if popup_span == 0:
            continue
        items.append(
            PopupItem(
                brand_name=brand,
                logo_url=logos[brand],
                line1=line1,
                line2=line2,
                url=link,
                border_color=color,
                col_span=popup_span,
                order=order,
            ).model_dump()
        )
        order += 1

    popup = dict(site["popup"])
    popup.update(
        {
            "enabled": True,
            "title": "GÜNCEL BONUS ADRESLERİ",
            "subtitle": "Aşağıdaki sponsorlardan birini seçerek anında üye olabilirsiniz",
            "columns": 3,
            "items": items,
        }
    )
    await db.sites.update_one({"id": site["id"]}, {"$set": {"popup": popup}})
    print(f"pop-up: {len(items)} kolon güncellendi")

    # --- Reklam kartları
    await db.ad_slots.delete_many({"site_id": site["id"]})
    for i, (brand, link, _u, line1, line2, color, _ps, card_span) in enumerate(SPONSORS):
        slot = AdSlot(
            site_id=site["id"],
            type="image",
            title="" if logos[brand] else brand,
            badge="SPONSOR" if card_span >= 3 else "",
            badge_position="center",
            badge_style="strip" if card_span >= 3 else "corner",
            border_color=color,
            description=line1,
            line2=line2,
            image_url=logos[brand],
            target_url=link,
            col_span=card_span,
            height=160 if card_span >= 3 else 150,
            order=i,
            text_size="md",
        )
        await db.ad_slots.insert_one(slot.model_dump())
    print(f"reklam kartları: {len(SPONSORS)} kart yazıldı")


if __name__ == "__main__":
    asyncio.run(main())
