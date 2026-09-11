# AdCore — Çok Domainli Reklam Portalı + Backoffice

## Ne yapar
Tek backoffice üzerinden sınırsız domain yönetilir. Her domain (site) kendi teması,
kolon sayısı, reklam alanları ve karşılama pop-up'ı ile yayınlanır. Ziyaretçi tarafı
gelen Host başlığına göre ilgili siteyi render eder; panelden `/?site=<slug>` ile önizlenir.

## Veri modeli (backend/models/schemas.py ↔ frontend/src/lib/types.ts)
- **Site**: id, slug (unique), name, domains[], title, tagline, logo_text, hero_image_url,
  marquee[], columns (1-6), theme{bg,panel,card,accent,accent2,text}, popup, custom_css,
  active, created_at
- **Popup**: enabled, title, subtitle, image_url, cta_text, cta_url, countdown_seconds,
  **columns (1-6)**, **items: PopupItem[]** — pop-up artık kolonlu marka kartı gridi
- **PopupItem**: id, brand_name, logo_url, line1, line2, url, border_color, col_span, order
- **AdSlot**: id, site_id, type("image"|"html"|"cta"), title, badge, description (1. satır),
  **line2**, image_url (logo), target_url, html, cta_text, **border_color** (neon çerçeve),
  col_span, height, order, active, clicks, created_at

## Ziyaretçi tasarımı (tuna40 tarzı)
Tek satır header: solda logo, **ortada kayan yazı (marquee, iki yanı maskeli)**, sağda
"Güncel" durum göstergesi. Yönetim butonu ve hero bölümü yok. Ana yüzey marka kartı gridi:
koyu plaka, neon çerçeve + köşe braketleri, ortada logo/marka adı ve iki bonus satırı.
Grid başlığı = site.title, altındaki ince satır = site.tagline (ikisi de panelden).
Pop-up (deniz23 tarzı) aynı kart dilini kolonlu grid olarak kullanır, sağ üstte kırmızı
yuvarlak kapatma butonu.

## Panel: reklam alanları listesi
Kartlar varsayılan olarak kapalı tek satır özet (sıra no, logo, başlık, neon renk, tip,
kolon/tıklama/durum) ~56px; "Düzenle" ile detay paneli açılır (~458px). Sürükle-bırak ve
yukarı/aşağı butonları `POST /api/sites/{id}/slots/reorder` ile kalıcı sıralama yapar.
- Koleksiyonlar: sites, ad_slots, admins, sessions (TTL), status_checks

## API (hepsi /api altında, api_router)
- POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout (httpOnly cookie `ads_session`)
- GET /api/public/site?slug=... (Host başlığı fallback), POST /api/public/slots/{id}/click
- /api/sites CRUD + /api/sites/{id}/slots CRUD (tümü auth gerektirir)

## Sayfalar
- `/` PublicPortal (marquee, hero, reklam grid, pop-up modal)
- `/admin/login`, `/admin` (site listesi), `/admin/sites/:siteId` (Genel/Domainler/Tasarım/
  Pop-up/Reklam Alanları sekmeleri), `/admin/cloudflare` (DNS kurulum rehberi)

## Auth
Tek admin rolü. Kullanıcı `admins` koleksiyonunda salt+sha256 ile saklanır; oturum
`sessions` koleksiyonunda token olarak tutulur, httpOnly cookie ile taşınır.

## Logo yükleme
`POST /api/uploads` (multipart, auth) → dosya Mongo `uploads` koleksiyonunda saklanır,
`{url: "/api/uploads/<id>"}` döner; `GET /api/uploads/{id}` public olarak servis eder.
PNG/JPG/WEBP/GIF/SVG, en fazla 2 MB.

## Şablon kopyalama
`POST /api/sites/{id}/duplicate` {slug, name, domains} → tema, pop-up kolonları ve tüm
reklam kartları yeni siteye kopyalanır (tıklama sayaçları sıfırlanır).

## Seed
`cd /app/backend && python seed.py` → 3 site: marco (11 marka kartı + 8 pop-up kolonu),
deniz23 (4 kart + 3 pop-up kolonu), vipbonus (2 kart, pop-up kapalı).
