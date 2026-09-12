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
- **AdSlot**: id, site_id, type("image"|"html"|"cta"), title, badge,
  **badge_position ("left"|"center"|"right")**, **badge_style ("tab"|"corner"|"strip"|"ribbon")**,
  **badge_bg** + **badge_text_color** (boşsa kartın neon rengi / siyah),
  **text_size ("sm"|"md"|"lg")**, description (1. satır),
  **line2**, image_url (logo), target_url, html, cta_text, **border_color** (neon çerçeve),
  col_span, height, order, active, clicks, created_at
  - Rozet stilleri: tab = üstte sekme, corner = köşeyi çapraz kesen bar (mobilde küçültülür,
    sadece sol/sağ; merkez seçilirse sağ köşe), strip = tam genişlik şerit (metin konuma göre
    hizalanır), ribbon = clip-path ile çentikli kurdele. İçerik üst dolgusu stile göre artar,
    böylece rozet başlığı kapatmaz.
  - Yazı ölçekleri `TEXT_SIZE_CLASSES` (frontend/src/lib/types.ts): sm 11/9px, md 13/10px,
    lg 16/12px (mobil) — sm/md/lg masaüstünde base/xl/2xl

## Ziyaretçi tasarımı (Marco tarzı)
Tek satır header: solda logo, **ortada kayan yazı (marquee, iki yanı maskeli)**, sağda
"Güncel" durum göstergesi. Yönetim butonu ve hero bölümü yok. Ana yüzey marka kartı gridi:
koyu plaka, neon çerçeve + köşe braketleri, ortada logo/marka adı ve iki bonus satırı.
Grid başlığı = site.title, altındaki ince satır = site.tagline (ikisi de panelden).
Pop-up (deniz23 tarzı) aynı kart dilini kolonlu grid olarak kullanır, sağ üstte kırmızı
yuvarlak kapatma butonu. Pop-up her ekran boyutunda dikey ortalanır (`items-center` +
`my-auto`); mobilde kapatma butonu panelin iç sağ üstünde durur.

## Mobil davranış (masaüstü paritesi)
Grid ve pop-up kolon sayısı ile kart sırası mobilde masaüstüyle **birebir aynıdır**
(`grid-cols-N` / `col-span-N`, breakpoint yok). Yalnızca ölçekler küçülür: kart yüksekliği
`calc(var(--card-h)*0.62)`, başlık 13px, satırlar 10px, rozet 9px — okunur kalır, yatay
kaydırma oluşmaz. Rozet kartın üstünde konumlanır ve içerik `pt-5` ile aşağı alınır, bu
yüzden başlığı kapatmaz.

## Panel: canlı cihaz önizlemesi
`Canlı Önizleme` sekmesi ziyaretçi sayfasını iframe'de gösterir: Mobil (390px), Tablet
(820px), Masaüstü (tam genişlik) + "Yenile". iframe tek kez mount edilir, cihaz değişiminde
yalnızca sarmalayıcı genişliği değişir; `?preview=1` ile pop-up bastırılır.
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

## Sponsor içe aktarma (deniz25.com)
`cd /app/backend && python import_deniz25.py` — deniz25.com pop-up sponsorlarının marka
adı, affiliate linki ve bonus satırlarını Marco sitesine yazar. Logolar **hotlink edilmez**:
ham kaynak yollarından (`/logos/*.webp`, `/api/media/...`) indirilip `uploads` koleksiyonuna
kaydedilir ve `/api/uploads/<id>` olarak servis edilir. `/_next/image` optimizasyon servisi
0 byte dönebildiği için ham yollar kullanılır; 200 byte altı yanıtlar atlanır (script idempotent).
8 pop-up kolonu + 10 reklam kartı (STAKE ve BETMANİ sadece kart olarak).

## Kütüphane (medya)
Sol menüde **Kütüphane** (`/admin/library`): sunucuda barındırılan tüm marka logoları —
çoklu yükleme, bağlantı kopyalama, silme. Uçlar: `GET /api/uploads` (liste, auth),
`POST /api/uploads` (yükleme), `DELETE /api/uploads/{id}`, `GET /api/uploads/{id}` (public).
Kart ve pop-up kolonlarındaki logo alanı `LogoPickerDialog` pop-up'ını açar: kütüphaneden
seçim + bilgisayardan yükleme (yüklenen görsel kütüphaneye de eklenir).

## Varsayılan tasarım şablonu
`Site.is_default` — tek seferde bir site. `POST /api/sites/{id}/set-default` ile ayarlanır
(panelde yıldız butonu + "Varsayılan tasarım" rozeti). Yeni site oluşturulduğunda şablonun
teması, kolon sayısı, özel CSS'i ve pop-up ayarları devralınır (pop-up kolonları ve reklam
kartları kopyalanmaz). Marco Portal varsayılan olarak kayıtlıdır.

## Link sağlık kontrolü & istatistikler
`POST /api/sites/{id}/slots/check-links` — her kartın hedef linkini izler; 404/410/5xx ve
bağlantı hatası ölü/bozuk sayılır, **403/405/406/429 bot koruması olduğu için "ok"** kabul
edilir (yanlış alarm olmasın). Sonuç kartta kırmızı rozet olarak görünür.
`GET /api/sites/{id}/stats?days=7|14|30` — `click_events` koleksiyonundan günlük seri +
sponsor sıralaması; panelde "İstatistikler" sekmesinde recharts grafiği.

## Kart arkası efektleri
`AdSlot.effect` ("none"|"glow"|"sweep"|"aurora"|"border") + `effect_speed` (saniye).
Keyframe'ler `index.css` içinde (`card-fx-*`), `prefers-reduced-motion` ile kapanır.
Kart ayarlarından açılıp kapatılır.

## Şablon kopyalama
`POST /api/sites/{id}/duplicate` {slug, name, domains} → tema, pop-up kolonları ve tüm
reklam kartları yeni siteye kopyalanır (tıklama sayaçları sıfırlanır).

## Seed
`cd /app/backend && python seed.py` → 3 site: marco (11 marka kartı + 8 pop-up kolonu),
deniz23 (4 kart + 3 pop-up kolonu), vipbonus (2 kart, pop-up kapalı).

## Yükleme kuralları
Logo/görsel yükleme: PNG, JPG, WEBP, GIF, SVG — maks 10 MB (backend/routers/uploads.py).

## Cloudflare / DNS entegrasyonu
- Token: backend/.env `CLOUDFLARE_API_TOKEN` (yalnızca backend; tarayıcıya gitmez)
- API: `/api/cloudflare/status|settings|zones|zones/{id}/records|autowire` (hepsi admin cookie gerektirir)
- `settings` koleksiyonunda `id=cloudflare` dokümanı: `server_ip`, `account_id`, `account_name`
- autowire: zone yoksa oluşturur, @ ve www icin A kaydini server_ip ye proxy acik yazar
- Cloudflare hatalari 400 + detail metni olarak doner (502 ingress tarafindan yutuluyor)

### Cloudflare ek ozellikler
- GET /api/cloudflare/verify-domains: her site domaini icin zone/NS/A kaydi + canli DNS cozumlemesi, issues listesi
- POST /api/cloudflare/zones/{id}/purge-cache: purge_everything
- GET|PUT /api/cloudflare/zones/{id}/ssl: ssl modu (off/flexible/full/strict) + always_use_https
- POST /api/cloudflare/autowire artik opsiyonel site_id alir: domain secilen sitenin domains listesine eklenir
- UI: frontend/src/components/admin/CloudflarePanels.tsx (DomainVerifyPanel, ZoneSslPanel)

### Onbellek & domain silme
- settings.auto_purge (varsayilan true): PUT /api/cloudflare/auto-purge ile degisir
- PUT /api/sites/{id} sonrasi routers.cloudflare.purge_site_cache(site_id) fire-and-forget calisir (sitenin domainlerine ait zone onbellegi)
- POST /api/cloudflare/remove-domain {site_id, domain, delete_dns}: domaini siteden ceker, delete_dns ise kok+www A/CNAME kayitlarini Cloudflare dan siler, sonuc warning alani ile doner

## Kendi sunucuya kurulum
- deploy/ dizini: install.sh (Ubuntu tek komut), nginx-adcore.conf (panel domaini + default_server ile tum reklam domainleri), adcore-backend.service (uvicorn 127.0.0.1:8001), ssl.sh (certbot), update.sh, env.example, README.md
- Panel domaini: marcopanel.site · Sunucu: 203.161.57.207 · Prod frontend: yarn build -> frontend/dist Nginx tarafindan servis edilir

## Uretim ortami notlari (kendi VPS)
- CPU AVX desteklemiyorsa MongoDB 5.0+ calismaz (signal=ILL). Cozum: Docker ile mongo:4.4 (port 127.0.0.1:27017, volume /var/lib/mongo44).
- backend/requirements.txt icindeki emergentintegrations Emergent ozel deposunda; uretimde deploy/requirements-prod.txt kullanilir.
- Ubuntu 24.04 (noble) icin MongoDB apt deposu 8.0 surumudur (7.0 noble icermez).

## Host bazli yonlendirme (panel vs portal)
- backend/.env: PANEL_DOMAIN (bos ise preview davranisi: bilinen reklam domaini portal, digerleri panel)
- GET /api/public/host-role -> {host, role: panel|portal, slug, panel_domain}
- frontend/src/components/HostGate.tsx: kok adres panelde /admin e yonlendirir, reklam domaininde PublicPortal gosterir; ?site=slug her zaman onizleme portali
- AdminOnlyHost: /admin* rotalari reklam domainlerinde 404 ekrani gosterir (Nginx tarafinda da location /admin return 404)

## Otomatik guncelleme (kendi sunucu)
- deploy/auto-update.sh: origin/main degistiyse git reset --hard + pip + yarn build + systemctl restart; cron kurulumu: bash deploy/auto-update.sh --install (5 dk)
- Log: /var/log/adcore-auto-update.log ; backend/.env repoda olmadigi icin korunur
- Emergent Publish kendi barindirmasina yayinlar; kendi sunucuya akis: Save to GitHub -> cron

### Cloudflare kimlik yontemleri
- lib/cloudflare.py: credentials() -> Global API Key (CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY, X-Auth-* basliklari) varsa onu kullanir; yoksa CLOUDFLARE_API_TOKEN (Bearer).
- Global Key tum izinlere sahiptir (purge + zone create); token ile purge icin Zone:Cache Purge izni gerekir.
- status ucunda Global Key kullanilirken /user/tokens/verify yerine /zones ile dogrulama yapilir (token_status = "active (global key)").

### IPv6 / zone ayarlari
- autowire artik zone icin IPv6 Compatibility = off yapar (best-effort): bazi aglarda IPv6 edge 1034 Edge IP Restricted veriyordu, origin yalnizca IPv4 dinliyor.
- GET/PUT /api/cloudflare/zones/{id}/ssl artik ipv6 alanini da tasir; panelde SSL & Onbellek bolumunde IPv6 AC/KAPA dugmesi var.
- Reklam domainlerinde SSL modu flexible onerilir (origin sertifikasi yok).

## !! CANLI KAYNAKLAR — TESTLER DOKUNMAMALI
- Cloudflare zone `marcopanel.site` = CANLI yonetim paneli domaini (sunucu 203.161.57.207). DNS/SSL/IPv6 ayarlari degistirilmemeli.
- Cloudflare zone `sultan5.com` = CANLI reklam domaini. Dogru ayarlar: ssl=flexible, ssl_automatic_mode=custom, ipv6=off. Full/strict veya ipv6=on yapilirsa site 526/1034 verir.
- Backend testleri bu zone ayarlarini degistirmemeli; degistiriyorsa test sonunda mutlaka yukaridaki degerlere geri almalidir.

## Cloudflare Tunnel mimarisi (tek tunel, catch-all)
- Panel: Cloudflare / DNS -> "Cloudflare Tunnel" karti (frontend/src/components/admin/TunnelPanel.tsx).
- Uclar: GET /api/cloudflare/tunnel (durum: status/connections/colos/ingress_ok/target),
  POST /api/cloudflare/tunnel/rebuild {name, include_panel} -> eski tunelleri siler, yeni tunel kurar,
  ingress = [{"service":"http://127.0.0.1:80"}] (hostname YOK = catch-all; cloudflared Host basligini aynen iletir),
  paneldeki tum site domainlerini tunele CNAME'ler, VPS icin tek satir install_command doner.
- settings dokumani: {tunnel_id, tunnel_name} eklendi. tunnel_id varsa:
  - /autowire A kaydi degil, <tunnel_id>.cfargotunnel.com CNAME yazar (origin IP hic yayinlanmaz),
  - /verify-domains beklenen hedef olarak tunel CNAME'ini kontrol eder.
- Yeni domain eklemek icin tunel config'i degistirmek GEREKMEZ: sadece autowire (CNAME) yeter.
- Aktif tunel: marco-tunnel / 3ca29d12-9f9f-410d-a8a9-e38400239cd2 (VPS'te cloudflared systemd servisi).

### Panel domaini tunelde (ONEMLI)
- POST /api/cloudflare/tunnel/attach-panel: PANEL_DOMAIN'i mevcut tunele ekler (yeni token/VPS islemi YOK).
- Panel origin'de 80 -> 443 redirect yapar; bu yuzden panel icin ingress `https://127.0.0.1:443` +
  originRequest.originServerName = PANEL_DOMAIN olmali. http://127.0.0.1:80 kullanilirsa sonsuz redirect dongusu olur.
- Ingress sirasi: panel hostname kurallari -> en sonda catch-all {"service":"http://127.0.0.1:80"} (reklam domainleri).
- marcopanel.site ve www.marcopanel.site 12 Eyl itibariyle tunel CNAME'inde; A kaydi kalmadi.

### UYARI: "Tuneli sifirdan kur" yikici bir islemdir
- rebuild eski tuneli SILER; sunucudaki cloudflared silinmis tunele bagli kaldigi icin panel + tum reklam
  domainleri Cloudflare 530/1033 verir. Kurtarma: yeni tunel tokenini VPS'te
  `cloudflared service uninstall; cloudflared service install <TOKEN>; systemctl enable --now cloudflared`.
- Bu yuzden butona window.confirm uyarisi eklendi ve rebuild artik PANEL_DOMAIN icin https ingress kuralini
  otomatik koruyor (yoksa panelde sonsuz redirect olur).
- 12 Eyl: kullanici butona bastigi icin tunel 3ca29d12 silindi, yerine 11aba424-2562-4c14-b74b-f7a403ef5466 kuruldu;
  tum domainler (sultan5.com, marcopanel.site, harem5.com) bu tunele CNAME'lendi.

## YENI MIMARI (12 Eyl, nihai): Cloudflare PROXY KAPALI — dogrudan origin
- Neden: kullanicinin agindaki resolver eski/yabanci Cloudflare edge IP'sini onbellekte tutuyordu ->
  tarayicida surekli "Error 1034 Edge IP Restricted". Tunel/proxy ne yapilirsa yapilsin kullanici goremiyordu.
- Cozum: marcopanel.site, sultan5.com, harem5.com icin @ + www = A kaydi 203.161.57.207,
  proxied=FALSE (gri bulut), TTL 120. Cloudflare artik yalnizca DNS saglayicisi.
- cloudflared (tunel) devre disi: `cloudflared service uninstall` + systemctl disable. Tuneller kullanilmiyor.
- HTTPS artik tamamen origin'de (Let's Encrypt):
  - panel: certbot ile marcopanel.site sertifikasi (mevcut, panel server blogunda)
  - reklam domainleri: tek SAN sertifikasi, cert adi "ads" -> /etc/letsencrypt/live/ads/
    ve /etc/nginx/sites-enabled/adcore-ads-ssl icinde `listen 443 ssl default_server` blogu
    (SNI panel domainine uymayan her istek buraya duser, /admin -> 404, Host basligi proxy'e aktarilir).
  - NOT: sunucuda Nginx 1.24 var; `http2 on;` direktifi YOK (1.25+). Kullanilmiyor.
- Yeni reklam domaini ekleme akisi:
  1) Panel -> Cloudflare/DNS -> domaini ekle (A kaydi, proxy KAPALI olmali),
  2) sunucuda `bash /opt/adcore/deploy/ssl-ads.sh sultan5.com <yenidomain>` (tum reklam domainlerini yaz),
  3) script sertifikayi --expand ile yeniler ve nginx'i reload eder.
- Panel kodundaki Tunnel karti/uclari kodda duruyor ama kullanilmiyor; "Tuneli sifirdan kur" butonuna BASMAYIN.

## Default Tasarimlar (tasarim sablonlari) — 12 Eyl
- Koleksiyon: `design_templates`. Model: DesignTemplate {id, name(unique), description, source_site_slug,
  preview_image_url, used_count, snapshot, created_at}.
  snapshot = DesignTemplateSnapshot {title, tagline, logo_text, hero_image_url, marquee, columns, theme,
  popup, custom_css, slots[]} -> siteden KOPYA; kaynak site sonradan degisse sablon degismez.
- Uclar (backend/routers/templates.py, hepsi /api/templates altinda, require_admin):
  GET ""  POST "" {name, source_site_id, description, include_slots}  GET/PUT/DELETE "/{id}"
  POST "/{id}/create-site" {slug, name, domains[], include_slots} -> yeni Site (+ istenirse kartlar), used_count++.
- Panel: sol menude "Default Tasarimlar" (/admin/templates, frontend/src/pages/AdminTemplates.tsx).
  Kart grid'i; karta tiklayinca "Bu tasarimla site olustur" diyalogu (slug/isim/domainler/kartlari kopyala),
  olusturunca dogrudan site editorune yonlendirir. "Siteden sablon kaydet" butonu ile mevcut siteden sablon alinir.
- Not: sites.py'daki eski `is_default` mantigi (tek varsayilan site) korundu; yeni sablon sistemi ondan bagimsiz.

### Sablon onizleme + guncelleme (12 Eyl)
- Kart gorseli: TemplateThumb — kaynak site (source_site_slug) hala varsa GERCEK sayfayi
  iframe `/?site=<slug>&preview=1` ile 0.32 olcekte gosterir (pointer-events:none, "CANLI" etiketi);
  site silinmisse tema renklerinden minyatur grid cizer.
- POST /api/templates/{id}/refresh {source_site_id, include_slots} -> secilen sitenin GUNCEL tasarimini
  snapshot'in uzerine yazar (source_site_slug + preview_image_url da guncellenir). Daha once o sablonla
  olusturulmus siteler etkilenmez. UI: kart uzerindeki dairesel yenile ikonu -> template-refresh-dialog.
- harem5.com Cloudflare'den TAMAMEN silindi (zone delete). Kalan zone'lar: marcopanel.site, sultan5.com.

## SEO / Sekme alanlari (12 Eyl)
- Site modeline eklendi: seo_title, seo_description, favicon_url (SiteBase + SiteUpdate + TS Site).
- PublicPortal, frontend/src/lib/usePortalHead.ts ile document.title, meta[name=description],
  og:title/og:description ve link[rel=icon]/apple-touch-icon degerlerini SITEYE gore ayarlar.
  Bos birakilirsa sirasiyla title -> name ve tagline kullanilir.
- Panel: site editorunde "SEO / Sekme" sekmesi (tab-seo): baslik, aciklama (karakter sayaci),
  favicon (LogoPickerDialog ile kutuphaneden) ve "Google'da boyle gorunecek" onizleme karti.
- Her domain kendi sitesinin degerlerini kullanir; index.html'deki statik baslik yalnizca panel icin gecerli.

## Dogrudan baglanti modu (direct mode)
- POST /api/cloudflare/direct-mode {server_ip?, include_panel} -> tum site domainleri (+panel) icin
  @ ve www A kaydi = server_ip, proxied=FALSE, ttl=120; settings.tunnel_id temizlenir (tunel modundan cikis).
  Yanit ssl_command ile `bash /opt/adcore/deploy/ssl-ads.sh <domainler>` komutunu verir.
- Panelde Cloudflare/DNS sayfasindaki karttan "Doğrudan sunucuya bağla (önerilen)" butonu.

## Favicon bolumu + robots/sitemap (12 Eyl)
- Hazir faviconlar: frontend/public/favicons/{crown,dice,flame,diamond,star,ball,shield,bolt}.svg
  (statik servis, /favicons/x.svg). Secici: frontend/src/components/admin/FaviconPicker.tsx
  — hazir ikon grid'i + "kendi ikonumu yukle" (LogoPickerDialog) + Kaldir. Site editoru SEO sekmesinde.
- robots.txt / sitemap.xml Host basligina gore backend'de uretilir (routers/public.py):
  GET /api/public/robots.txt  -> panel domaini icin "Disallow: /", reklam domainleri icin Allow + Sitemap satiri
  GET /api/public/sitemap.xml -> o domainin sitesi yayindaysa tek URL'lik sitemap, panel domaini/bilinmeyen domain 404
- Nginx bunlari koke bagliyor (deploy/nginx-adcore.conf ve deploy/ssl-ads.sh icindeki 443 blogu):
  `location = /robots.txt { proxy_pass http://127.0.0.1:8001/api/public/robots.txt; proxy_set_header Host $host; }`
  aynisi /sitemap.xml icin. VPS'te mevcut nginx dosyalarina bu iki location ELDE eklenmeli (auto-update conf'u ezmez).

## Aktif domain kontrolu (12 Eyl)
- Site.active_domain (SiteBase + SiteUpdate + TS Site). BOS ise TUM domainler yayinda (geriye uyumluluk).
  Doluysa YALNIZCA o domain siteyi yayinlar.
- PUT /api/sites/{id} active_domain'i domain listesine gore dogrular (yoksa 422) ve www. onekini atar.
- GET /api/public/site: host bilinen bir domain ama active_domain degilse
  PublicSite{status:"pending", slots:[]} doner (tasarim/kart gosterilmez).
  PublicSite modeline `status: "live"|"pending"` alani eklendi (TS PublicSite ile eslendi).
- Portal: status=="pending" ise components/portal/DomainPendingScreen.tsx -> "Domain hazirlaniyor" ekrani.
- Panel: site editoru > Domainler sekmesinde her satirda "Aktif Et" butonu; aktif olanda "AKTIF" etiketi.
  Aktif domain silinirse active_domain temizlenir.
