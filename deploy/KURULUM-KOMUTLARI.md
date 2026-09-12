# marcopanel.site KURULUM — sana özel komutlar
Repo: https://github.com/serverninjaa/linkmarco (public) · Sunucu: 203.161.57.207 (root)

---
## ADIM 1 — Sunucu kurulumu (tek blok, kopyala-yapıştır)
Sunucuda **root** olarak:
```bash
apt-get update -y && apt-get install -y git
git clone https://github.com/serverninjaa/linkmarco.git /opt/adcore
bash /opt/adcore/deploy/install.sh marcopanel.site /opt/adcore
```
5-10 dakika sürer (MongoDB + Node + build). Bitince çıktının son 20 satırını bana yapıştır.

## ADIM 2 — .env dosyası
```bash
cat > /opt/adcore/backend/.env <<'EOF'
MONGO_URL="mongodb://127.0.0.1:27017"
DB_NAME="adcore"
CORS_ORIGINS="https://marcopanel.site"
APP_URL="https://marcopanel.site"
ADMIN_USER="admin"
ADMIN_PASSWORD="BURAYA_GUCLU_SIFRE_YAZ"
CLOUDFLARE_API_TOKEN="<CLOUDFLARE_API_TOKEN>"
EOF
systemctl restart adcore-backend
sleep 3 && curl -s localhost:8001/api/ && echo   #  {"message":"Hello World"} dönmeli
```

## ADIM 3 — Mevcut veriyi taşı (siteler, reklam kartları, logolar)
Arşiv repoda: `deploy/seed-data/adcore-data.archive` (oturum/şifre verisi içermez).
```bash
mongorestore --uri="mongodb://127.0.0.1:27017" \
  --archive=/opt/adcore/deploy/seed-data/adcore-data.archive --gzip \
  --nsFrom='app.*' --nsTo='adcore.*'
systemctl restart adcore-backend
```
Bu adımı atlarsan sunucu boş başlar (istersen `/opt/adcore/venv/bin/python /opt/adcore/backend/seed.py`
ile 3 örnek site oluşur).

## ADIM 4 — DNS (Cloudflare)
1. Cloudflare → **Add a domain** → `marcopanel.site` (Free).
2. Verdiği 2 nameserver'ı Namecheap → Domain List → Manage → **Nameservers → Custom DNS** alanına yaz.
3. Zone "Active" olunca: `A @ → 203.161.57.207` ve `A www → 203.161.57.207`
   (panelden "Tek tıkla domain bağla" ile de yazılabilir).
4. Kontrol: `curl -I http://marcopanel.site` → 200/301 dönmeli.

## ADIM 5 — SSL
Sertifika alırken Cloudflare proxy'sini geçici olarak **DNS only (gri bulut)** yap:
```bash
bash /opt/adcore/deploy/ssl.sh marcopanel.site
```
Sonra Cloudflare → SSL/TLS → **Full (strict)**, proxy'yi geri aç.
Panel: **https://marcopanel.site/admin**

## ADIM 6 — Güncelleme (ileride kod değişince)
```bash
bash /opt/adcore/deploy/update.sh /opt/adcore
```

---
### Takılırsan
```bash
systemctl status adcore-backend --no-pager
journalctl -u adcore-backend -n 50 --no-pager
nginx -t
```
çıktısını bana yapıştır.
