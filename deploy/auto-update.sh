#!/usr/bin/env bash
# Otomatik güncelleme: GitHub'da yeni commit varsa çeker, derler, servisi yeniler.
# Cron ile 5 dakikada bir çalıştırılır. Değişiklik yoksa hiçbir şey yapmaz.
# Kurulum: sudo bash deploy/auto-update.sh --install
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/adcore}"
BRANCH="${BRANCH:-main}"
LOG="/var/log/adcore-auto-update.log"

if [ "${1:-}" = "--install" ]; then
  ( crontab -l 2>/dev/null | grep -v 'adcore/deploy/auto-update.sh'
    echo "*/5 * * * * APP_DIR=$APP_DIR bash $APP_DIR/deploy/auto-update.sh >> $LOG 2>&1" ) | crontab -
  echo "Cron kuruldu (5 dakikada bir). Log: $LOG"
  crontab -l | tail -2
  exit 0
fi

cd "$APP_DIR"
git fetch --quiet origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0                       # değişiklik yok, sessiz çık
fi

echo "[$(date '+%F %T')] yeni commit: ${REMOTE:0:8} — guncelleme basliyor"
# Sunucuya özel .env dosyası repoda olmadığı için korunur; yerel değişiklikler ezilir.
git reset --hard "origin/$BRANCH" --quiet

if [ -f "$APP_DIR/deploy/requirements-prod.txt" ]; then
  "$APP_DIR/venv/bin/pip" install -q -r "$APP_DIR/deploy/requirements-prod.txt"
fi

cd "$APP_DIR/frontend"
yarn install --frozen-lockfile --silent
yarn build

systemctl restart adcore-backend
systemctl reload nginx
echo "[$(date '+%F %T')] guncelleme tamam: ${REMOTE:0:8}"
