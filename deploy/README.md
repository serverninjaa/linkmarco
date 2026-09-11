# AdCore Backoffice — Kendi Sunucuna Kurulum (Ubuntu 22/24)

Panel domaini: **marcopanel.site** · Sunucu: **203.161.57.207**

Mimari: Nginx (80/443) → statik React build (`frontend/dist`) + `/api` → uvicorn 127.0.0.1:8001 → MongoDB (localhost).
Reklam domainleri aynı sunucuya düşer; uygulama **Host başlığına** göre ilgili sitenin tasarımını gösterir, bu yüzden panel dışındaki tüm domainler için ek yapılandırma gerekmez.

---

## 0) Kodu sunucuya al
Emergent arayüzünde **Save → Save to GitHub** ile repoya push et (ücretli plan gerekir). Repo URL'sini not al.
Alternatif: kodu indirip `scp -r ./app root@203.161.57.207:/opt/adcore` ile kopyala.

## 1) DNS (Cloudflare)
Panelin Cloudflare sayfasından ya da Cloudflare arayüzünden:
```
A   marcopanel.site       → 203.161.57.207   (proxy: açık)
A   www.marcopanel.site   → 203.161.57.207   (proxy: açık)
```
SSL sertifikası alırken (adım 3) proxy'yi geçici olarak **DNS only (gri bulut)** yap.

## 2) Tek komutla kurulum
Sunucuda `root` olarak:
```bash
apt-get update -y && apt-get install -y git
git clone <REPO_URL> /opt/adcore
sudo bash /opt/adcore/deploy/install.sh marcopanel.site /opt/adcore
```
Script şunları yapar: Node 20 + yarn, MongoDB 7, Python venv + `requirements.txt`, `yarn build`,
`adcore-backend.service` (systemd), Nginx yapılandırması, UFW (22/80/443).

Kurulumdan sonra **`/opt/adcore/backend/.env`** dosyasını doldur:
```
MONGO_URL="mongodb://127.0.0.1:27017"
DB_NAME="adcore"
CORS_ORIGINS="https://marcopanel.site"
APP_URL="https://marcopanel.site"
ADMIN_USER="admin"
ADMIN_PASSWORD="güçlü-bir-şifre"
CLOUDFLARE_API_TOKEN="cfut_..."
```
Sonra: `sudo systemctl restart adcore-backend`

## 3) SSL
```bash
sudo bash /opt/adcore/deploy/ssl.sh marcopanel.site
```
Bitince Cloudflare → SSL/TLS → **Full (strict)**, "Always Use HTTPS" açık (panelden de yapabilirsin).

## 4) Veri taşıma (preview → sunucu, opsiyonel)
Preview ortamında:
```bash
mongodump --uri="$MONGO_URL" --db="$DB_NAME" --archive=/tmp/adcore.archive --gzip
```
Dosyayı sunucuya kopyala ve:
```bash
mongorestore --uri="mongodb://127.0.0.1:27017" --archive=/opt/adcore.archive --gzip --nsFrom='<eskiDB>.*' --nsTo='adcore.*'
```
Yüklenen logolar Mongo içinde saklanır, ayrıca dosya taşımaya gerek yok.

## 5) Reklam domainlerini bağlama
Her yeni reklam domaini için:
1. Panel → **Cloudflare / DNS** → "Tek tıkla domain bağla": domaini yaz, siteyi seç, **Bağla**.
2. Zone yeni açıldıysa kayıt firmasındaki nameserver'ları Cloudflare'ın verdiği NS'lere çevir.
3. Panel → **Domain Doğrulama** ile NS + A kaydını kontrol et (hepsi yeşil olmalı).
Nginx tarafında hiçbir şey yapmana gerek yok — `default_server` bloğu tüm domainleri karşılar.

## 6) Günlük işler
```bash
systemctl status adcore-backend      # durum
journalctl -u adcore-backend -f      # canlı log
sudo bash /opt/adcore/deploy/update.sh /opt/adcore   # kod güncelleme + yeniden build
```
Yedek (günlük cron önerisi):
```bash
0 4 * * * mongodump --uri="mongodb://127.0.0.1:27017" --db=adcore --archive=/var/backups/adcore-$(date +\%F).gz --gzip
```

## Sorun giderme
| Belirti | Kontrol |
|---|---|
| 502 Bad Gateway | `systemctl status adcore-backend`, `journalctl -u adcore-backend -n 50` |
| Panel açılıyor, API 404 | Nginx'te `/api/` bloğu ve `proxy_pass http://127.0.0.1:8001` |
| Reklam domaini yanlış site gösteriyor | `proxy_set_header Host $host;` satırı ve panelde domain-site eşlemesi |
| Logo yüklenmiyor (413) | Nginx `client_max_body_size 12M` |
| Certbot doğrulaması başarısız | Cloudflare proxy'yi geçici olarak DNS only yap |
