#!/bin/bash
# tuli — build & deploy helper. Run on the server for every release, after pushing to GitHub:
#   bash /root/nubian_invoices/deploy.sh
set -euo pipefail

REPO=/root/nubian_invoices
FE_DEPLOY=/var/www/nubian-invoices
PM2_APP=nubian-invoices-api

echo "==> [1/5] Update repo"
cd "$REPO"
git pull --ff-only

echo "==> [2/5] Install dependencies (also downloads headless Chrome for PDFs on first run)"
npm ci

echo "==> [3/5] Build & publish frontend"
cd "$REPO/apps/web"
npm run build
mkdir -p "$FE_DEPLOY"
rm -rf "${FE_DEPLOY:?}/"*
cp -r out/* "$FE_DEPLOY"/

echo "==> [4/5] Build backend + apply migrations"
cd "$REPO/apps/api"
npm run build
npx prisma migrate deploy

echo "==> [5/5] Restart API under pm2"
pm2 restart "$PM2_APP" --update-env || pm2 start ecosystem.config.js
pm2 save

echo "Done. Frontend -> $FE_DEPLOY   API -> pm2:$PM2_APP"
