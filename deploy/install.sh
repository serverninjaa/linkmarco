#!/usr/bin/env bash
# AdCore backoffice — Ubuntu 22/24 tek seferlik kurulum.
# Kullanım:  sudo bash deploy/install.sh marcopanel.site /opt/adcore https://github.com/KULLANICI/REPO.git
set -euo pipefail

PANEL_DOMAIN="${1:-marcopanel.site}"
APP_DIR="${2:-/opt/adcore}"
REPO_URL="${3:-}"

echo "==> Paketler kuruluyor"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx ufw gnupg ca-certificates python3-venv python3-pip

echo "==> Node.js 20 + yarn"
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g yarn >/dev/null

echo "==> MongoDB deposu (Ubuntu sürümüne göre)"
# NOT: MongoDB 5.0+ CPU'da AVX desteği ZORUNLU. AVX yoksa (lscpu | grep avx boş dönerse)
# mongod "signal=ILL / core-dump" ile çöker. O durumda Docker ile MongoDB 4.4 kullan:
#   apt-get install -y docker.io && systemctl enable --now docker
#   docker run -d --name mongo44 --restart always -p 127.0.0.1:27017:27017 \
#     -v /var/lib/mongo44:/data/db mongo:4.4
if ! command -v mongod >/dev/null; then
  CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  # noble (24.04) için MongoDB 8.0, jammy (22.04) için 7.0 yayınlanmıştır.
  case "$CODENAME" in
    noble) MONGO_VER="8.0" ;;
    *)     MONGO_VER="7.0" ;;
  esac
  rm -f /etc/apt/sources.list.d/mongodb-org-*.list
  curl -fsSL "https://pgp.mongodb.com/server-${MONGO_VER}.asc" \
    | gpg --dearmor -o "/usr/share/keyrings/mongodb-server-${MONGO_VER}.gpg"
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-${MONGO_VER}.gpg ] https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/${MONGO_VER} multiverse" \
    > "/etc/apt/sources.list.d/mongodb-org-${MONGO_VER}.list"
  apt-get update -y
  apt-get install -y mongodb-org
fi
systemctl enable --now mongod

echo "==> Kod ${APP_DIR} dizinine alınıyor"
mkdir -p "$APP_DIR"
if [ -n "$REPO_URL" ]; then
  if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull --ff-only; else git clone "$REPO_URL" "$APP_DIR"; fi
else
  echo "    (REPO_URL verilmedi — kodu $APP_DIR içine kendiniz kopyalayın)"
fi

echo "==> Backend venv + bağımlılıklar"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip wheel >/dev/null
# Üretimde Emergent'a özel paketler ve dev araçları olmadan kurulur.
if [ -f "$APP_DIR/deploy/requirements-prod.txt" ]; then
  "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/deploy/requirements-prod.txt"
else
  "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"
fi

if [ ! -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/deploy/env.example" "$APP_DIR/backend/.env"
  echo "    !! $APP_DIR/backend/.env dosyasını doldurun (CLOUDFLARE_API_TOKEN, ADMIN_PASSWORD)"
fi

echo "==> Frontend production build"
cd "$APP_DIR/frontend"
yarn install --frozen-lockfile
yarn build   # çıktı: frontend/dist

echo "==> systemd servisi"
install -m 644 "$APP_DIR/deploy/adcore-backend.service" /etc/systemd/system/adcore-backend.service
sed -i "s|__APP_DIR__|$APP_DIR|g" /etc/systemd/system/adcore-backend.service
systemctl daemon-reload
systemctl enable --now adcore-backend

echo "==> Nginx"
install -m 644 "$APP_DIR/deploy/nginx-adcore.conf" /etc/nginx/sites-available/adcore
sed -i "s|__PANEL_DOMAIN__|$PANEL_DOMAIN|g; s|__APP_DIR__|$APP_DIR|g" /etc/nginx/sites-available/adcore
ln -sf /etc/nginx/sites-available/adcore /etc/nginx/sites-enabled/adcore
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Güvenlik duvarı"
ufw allow OpenSSH >/dev/null || true
ufw allow 'Nginx Full' >/dev/null || true
yes | ufw enable >/dev/null || true

echo
echo "BİTTİ. Sıradaki adımlar:"
echo " 1) Cloudflare'da $PANEL_DOMAIN için A kaydı → sunucu IP (proxy açık olabilir)"
echo " 2) SSL: sudo bash $APP_DIR/deploy/ssl.sh $PANEL_DOMAIN"
echo " 3) Panel: https://$PANEL_DOMAIN/admin  (admin / .env içindeki ADMIN_PASSWORD)"
