# AdCore — Çok Domainli Reklam Portalı + Backoffice

## Ne yapar
Tek backoffice üzerinden sınırsız domain yönetilir. Her domain (site) kendi teması,
kolon sayısı, reklam alanları ve karşılama pop-up'ı ile yayınlanır. Ziyaretçi tarafı
gelen Host başlığına göre ilgili siteyi render eder; panelden `/?site=<slug>` ile önizlenir.

## Veri modeli (backend/models/schemas.py ↔ frontend/src/lib/types.ts)
- **Site**: id, slug (unique), name, domains[], title, tagline, logo_text, hero_image_url,
  marquee[], columns (1-6), theme{bg,panel,card,accent,accent2,text}, popup{enabled,title,
  subtitle,image_url,cta_text,cta_url,countdown_seconds}, custom_css, active, created_at
- **AdSlot**: id, site_id, type("image"|"html"|"cta"), title, badge, description, image_url,
  target_url, html, cta_text, col_span, height, order, active, clicks, created_at
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

## Seed
`cd /app/backend && python seed.py` → 3 site (tuna40, deniz23, vipbonus) + 12 reklam alanı.
