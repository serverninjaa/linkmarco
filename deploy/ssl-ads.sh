#!/usr/bin/env bash
# Reklam domainleri için HTTPS (Cloudflare proxy KAPALI / DNS only mimarisi).
#
# Ne yapar:
#   1) Verilen domainler için tek bir SAN sertifikası alır (cert adı: "ads").
#   2) Nginx'e 443 default_server bloğu yazar → panelden eklenen TÜM reklam domainleri
#      bu blokla HTTPS servis edilir (SNI panel domainine uymayan her istek buraya düşer).
#   3) Nginx'i test edip reload eder.
#
# Kullanım (root):
#   bash /opt/adcore/deploy/ssl-ads.sh sultan5.com harem5.com
#   → www.* varyantları otomatik eklenir. Yeni domain eklerken TÜM reklam
#     domainlerini tekrar yazın (sertifika yeniden oluşturulur).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/adcore}"
CERT_NAME="ads"

if [ "$#" -eq 0 ]; then
  echo "Kullanım: bash $0 <domain1> [domain2] ..." >&2
  exit 1
fi

command -v certbot >/dev/null || { apt-get update -y && apt-get install -y certbot; }

ARGS=()
for d in "$@"; do
  d="${d#www.}"
  ARGS+=(-d "$d" -d "www.$d")
done

echo "== Sertifika alınıyor: $*"
certbot certonly --standalone --non-interactive --agree-tos \
  --register-unsafely-without-email --cert-name "$CERT_NAME" --expand \
  --pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx" \
  "${ARGS[@]}"

CERT_DIR="/etc/letsencrypt/live/$CERT_NAME"
[ -f "$CERT_DIR/fullchain.pem" ] || { echo "Sertifika bulunamadı: $CERT_DIR" >&2; exit 1; }

echo "== Nginx 443 default_server bloğu yazılıyor"
cat > /etc/nginx/sites-available/adcore-ads-ssl <<NGINX
# Reklam domainleri — HTTPS. SNI panel domainine uymayan tüm istekler buraya düşer.
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    http2 on;
    server_name _;

    ssl_certificate     $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root $APP_DIR/frontend/dist;
    index index.html;
    client_max_body_size 12M;

    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host \$host;             # domain eşleme için ZORUNLU
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    location /admin { return 404; }               # panel reklam domainlerinde kapalı
    location / { try_files \$uri \$uri/ /index.html; }
}
NGINX

ln -sf /etc/nginx/sites-available/adcore-ads-ssl /etc/nginx/sites-enabled/adcore-ads-ssl
nginx -t && systemctl reload nginx
echo "== Tamam. Test: curl -sI https://$1/ | head -1"
