#!/usr/bin/env bash
# Let's Encrypt SSL — panel domaini için.  Kullanım: sudo bash deploy/ssl.sh marcopanel.site
set -euo pipefail
DOMAIN="${1:-marcopanel.site}"

apt-get update -y
apt-get install -y certbot python3-certbot-nginx

# NOT: Cloudflare proxy (turuncu bulut) AÇIKSA HTTP-01 doğrulaması başarısız olabilir.
# Doğrulama sırasında proxy'yi geçici olarak "DNS only" (gri bulut) yapın, sonra geri açın.
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect --agree-tos -m "serverninjaa@gmail.com" -n

systemctl reload nginx
echo "SSL kuruldu: https://$DOMAIN"
echo "Cloudflare > SSL/TLS modunu 'Full (strict)' yapın."
