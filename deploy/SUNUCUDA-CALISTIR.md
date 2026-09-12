# SUNUCUDA ÇALIŞTIR — sırayla, her bloktan sonra çıktıyı bana yapıştır
Sunucu: 203.161.57.207 (root) · Panel domaini: marcopanel.site · Dizin: /opt/adcore

## BLOK 1 — Kod + kurulum (5-10 dk)
```bash
apt-get update -y && apt-get install -y git
rm -rf /opt/adcore
git clone https://github.com/serverninjaa/linkmarco.git /opt/adcore
bash /opt/adcore/deploy/install.sh marcopanel.site /opt/adcore 2>&1 | tail -30
```
→ Çıktının son 30 satırını yapıştır.

## BLOK 2 — .env + veri yükleme + servis
```bash
cat > /opt/adcore/backend/.env <<'EOF'
MONGO_URL="mongodb://127.0.0.1:27017"
DB_NAME="adcore"
CORS_ORIGINS="https://marcopanel.site"
APP_URL="https://marcopanel.site"
ADMIN_USER="admin"
ADMIN_PASSWORD="1727Fd40."
CLOUDFLARE_API_TOKEN="<CLOUDFLARE_API_TOKEN>"
EOF

mongorestore --uri="mongodb://127.0.0.1:27017" \
  --archive=/opt/adcore/deploy/seed-data/adcore-data.archive --gzip \
  --nsFrom='app.*' --nsTo='adcore.*' 2>&1 | tail -5

systemctl restart adcore-backend
sleep 4
echo "--- API ---"; curl -s localhost:8001/api/; echo
echo "--- SERVIS ---"; systemctl is-active adcore-backend
echo "--- NGINX ---"; nginx -t 2>&1 | tail -2
echo "--- SITELER ---"; curl -s -c /tmp/c -X POST localhost:8001/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"1727Fd40."}' >/dev/null; curl -s -b /tmp/c localhost:8001/api/sites | head -c 200; echo
echo "--- IP UZERINDEN PANEL ---"; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/
```
→ Tüm çıktıyı yapıştır. `{"message":"Hello World"}`, `active`, `syntax is ok`, site listesi ve `200` görmeliyiz.

## BLOK 3 — DNS (Cloudflare panelinde, sunucuda değil)
1. Cloudflare → **Add a domain** → `marcopanel.site` → Free plan.
2. Verilen 2 nameserver'ı Namecheap → Domain List → `marcopanel.site` → Manage →
   **Nameservers → Custom DNS** alanına yaz, kaydet.
3. Cloudflare'da zone **Active** olunca DNS kayıtları:
   `A  @  → 203.161.57.207` (proxy: **DNS only / gri bulut** — sertifika alana kadar)
   `A  www → 203.161.57.207` (proxy: DNS only)
4. Sunucuda kontrol:
```bash
getent hosts marcopanel.site; curl -s -o /dev/null -w "%{http_code}\n" http://marcopanel.site/
```

## BLOK 4 — SSL (DNS yayıldıktan sonra)
```bash
bash /opt/adcore/deploy/ssl.sh marcopanel.site 2>&1 | tail -15
curl -s -o /dev/null -w "%{http_code}\n" https://marcopanel.site/admin
```
Sonra Cloudflare → SSL/TLS → **Full (strict)** ve proxy'yi (turuncu bulut) geri aç.

## Panel bilgileri
- Adres: https://marcopanel.site/admin
- Kullanıcı: `admin` · Şifre: `1727Fd40.`

## Hata olursa bunları yapıştır
```bash
systemctl status adcore-backend --no-pager | tail -15
journalctl -u adcore-backend -n 40 --no-pager
nginx -t
```
