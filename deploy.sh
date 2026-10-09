#!/bin/bash
# tuli (tulidocs.com) — build & redeploy. Run on the server for every release, after pushing to GitHub:
#   bash /root/tulidocs/deploy.sh
# First time on a new server run deploy/setup-server.sh instead (it calls this script).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FE_DEPLOY=/var/www/tulidocs
PM2_APP=tulidocs-api
ENV_FILE="$REPO/apps/api/.env"

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE — run: bash $REPO/deploy/setup-server.sh"; exit 1; }
PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2)"

echo "==> [1/6] Update repo"
cd "$REPO"
[ "${1:-}" = "--no-pull" ] || git pull --ff-only

echo "==> [2/6] Install dependencies (downloads headless Chrome for PDFs on first run)"
NODE_ENV=development npm ci --include=dev --no-audit --no-fund

echo "==> [3/6] Database migrations"
cd "$REPO/apps/api"
npx prisma migrate deploy
npx prisma generate >/dev/null

echo "==> [4/6] Build backend"
npm run build

echo "==> [5/6] Build & publish frontend"
cd "$REPO/apps/web"
npm run build
# swap the new site in at once (no half-copied state while users browse)
mkdir -p "$(dirname "$FE_DEPLOY")"
rm -rf "$FE_DEPLOY.new" "$FE_DEPLOY.old"
cp -r out "$FE_DEPLOY.new"
[ -d "$FE_DEPLOY" ] && mv "$FE_DEPLOY" "$FE_DEPLOY.old"
mv "$FE_DEPLOY.new" "$FE_DEPLOY"
rm -rf "$FE_DEPLOY.old"

echo "==> [6/6] Restart API under pm2 (port $PORT)"
cd "$REPO/apps/api"
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save >/dev/null

# health check
for i in $(seq 1 20); do
  if curl -fs "http://127.0.0.1:$PORT/health" >/dev/null; then
    echo "API healthy on 127.0.0.1:$PORT"
    echo "Done. Frontend -> $FE_DEPLOY   API -> pm2:$PM2_APP"
    exit 0
  fi
  sleep 1
done
echo "API did not answer on port $PORT — check: pm2 logs $PM2_APP --lines 50"
exit 1
