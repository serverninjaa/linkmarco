#!/usr/bin/env bash
# Kod güncellemesi sonrası yeniden yayına alma. Kullanım: sudo bash deploy/update.sh /opt/adcore
set -euo pipefail
APP_DIR="${1:-/opt/adcore}"

git -C "$APP_DIR" pull --ff-only
if [ -f "$APP_DIR/deploy/requirements-prod.txt" ]; then
  "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/deploy/requirements-prod.txt"
else
  "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"
fi
cd "$APP_DIR/frontend" && yarn install --frozen-lockfile && yarn build
systemctl restart adcore-backend
systemctl reload nginx
echo "Güncelleme tamam."
