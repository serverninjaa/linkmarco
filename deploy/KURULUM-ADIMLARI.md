# Kurulum Kontrol Listesi — marcopanel.site / 203.161.57.207

Durum kontrolü (11 Eyl): SSH 22 açık, 80/443 boş (temiz sunucu). marcopanel.site kayıtlı,
şu an 162.255.119.122 (registrar park sayfası) — Cloudflare'a eklenmedi.

## ADIM 1 — Domaini Cloudflare'a ekle
1. https://dash.cloudflare.com → **Add a domain** → `marcopanel.site` → **Free** planı seç.
2. Cloudflare iki nameserver verir (örn. `xxx.ns.cloudflare.com`, `yyy.ns.cloudflare.com`) — bunları kopyala.
3. Domaini aldığın firmada (Namecheap görünüyor): Domain List → Manage → **Nameservers → Custom DNS**
   → iki Cloudflare NS'ini yaz → kaydet. (Yayılma genelde 5-60 dk.)
4. Cloudflare'da zone `Active` olunca haber ver → A kaydını **panelden tek tıkla** yazacağız
   (Cloudflare / DNS → "Tek tıkla domain bağla" → marcopanel.site).
   Alternatif manuel: `A  @ → 203.161.57.207` (proxy açık), `A  www → 203.161.57.207`.

## ADIM 2 — Kodu GitHub'a gönder
Emergent arayüzünde sohbet kutusundaki **Save → Save to GitHub** → repo seç/oluştur → push.
Sonra repo URL'sini bana ver (örn. `https://github.com/kullanici/adcore.git`).
Repo **private** ise sunucuda klonlarken GitHub kullanıcı adı + personal access token istenir.

## ADIM 3 — Sunucu kurulumu (kodu GitHub'a atınca)
Sunucuda root olarak, tek blok:
```bash
apt-get update -y && apt-get install -y git
git clone <REPO_URL> /opt/adcore
bash /opt/adcore/deploy/install.sh marcopanel.site /opt/adcore
```
Yaklaşık 5-10 dakika sürer (MongoDB + Node + build). Çıktının son 20 satırını bana yapıştır.

## ADIM 4 — .env doldur
```bash
nano /opt/adcore/backend/.env
```
```
MONGO_URL="mongodb://127.0.0.1:27017"
DB_NAME="adcore"
CORS_ORIGINS="https://marcopanel.site"
APP_URL="https://marcopanel.site"
ADMIN_USER="admin"
ADMIN_PASSWORD="kendi-guclu-sifren"
CLOUDFLARE_API_TOKEN="cfut_..."
```
```bash
systemctl restart adcore-backend
curl -s localhost:8001/api/ ; echo        # {"message":"Hello World"} dönmeli
```

## ADIM 5 — SSL
DNS yayıldıktan sonra (Cloudflare proxy'yi geçici olarak **DNS only / gri bulut** yap):
```bash
bash /opt/adcore/deploy/ssl.sh marcopanel.site
```
Sonra Cloudflare → SSL/TLS → **Full (strict)**, proxy'yi geri aç.

## ADIM 6 — Veri taşıma (mevcut siteler/logolar)
Preview'daki veriyi taşımak istersen söyle: `mongodump` arşivini hazırlar, `mongorestore`
komutunu veririm. İstemezsen sunucuda sıfır veriyle başlar (Marco şablonu otomatik oluşur).

## ADIM 7 — Reklam domainlerini bağla
Panel → Cloudflare / DNS → "Tek tıkla domain bağla" (domain + site seç) → Domain Doğrulama'da
hepsi yeşil olmalı. Nginx tarafında hiçbir ek iş yok.
