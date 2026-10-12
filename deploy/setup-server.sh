#!/bin/bash
# tuli (tulidocs.com) — ONE-TIME server setup. Safe to re-run: it skips anything already done.
#   bash /root/tulidocs/deploy/setup-server.sh
#
# What it does
#   1. Checks the API port is free (other apps run on this server)
#   2. Installs the system libraries headless Chrome needs for PDFs
#   3. Creates the Postgres database + user (random password)
#   4. Writes apps/api/.env for production (asks for the Google client ID/secret)
#   5. Installs the nginx site and gets an HTTPS certificate (certbot)
#   6. Runs the first deploy (deploy.sh) and creates the platform admin
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${DOMAIN:-tulidocs.com}"
PORT="${PORT:-4617}"            # uncommon on purpose: imports 4300, kaizen 4100, updates 4200 …
FE_DEPLOY="/var/www/tulidocs"
DB_NAME="tulidocs"
DB_USER="tulidocs_user"
ENV_FILE="$REPO/apps/api/.env"
SITE="/etc/nginx/sites-available/$DOMAIN"

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }

# ── 1. Port ─────────────────────────────────────────────
say "[1/6] Checking port $PORT"
# a production .env from an earlier run decides the port
if [ -f "$ENV_FILE" ] && grep -q '^NODE_ENV=production' "$ENV_FILE"; then PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2)"; fi
if ss -ltnp 2>/dev/null | grep -q ":$PORT "; then
  if pm2 jlist 2>/dev/null | grep -q '"name":"tulidocs-api"'; then
    echo "Port $PORT is ours (tulidocs-api) — fine."
  else
    warn "Port $PORT is already used by another process:"; ss -ltnp | grep ":$PORT "
    echo "Re-run with another port, e.g.  PORT=4627 bash $0"; exit 1
  fi
else
  echo "Port $PORT is free."
fi

# ── 2. Chrome libraries + tools ─────────────────────────
say "[2/6] System packages for headless Chrome (PDF rendering)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates fonts-liberation fonts-noto-color-emoji libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libgbm1 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 \
  libxshmfence1 >/dev/null
apt-get install -y -qq libasound2t64 >/dev/null 2>&1 || apt-get install -y -qq libasound2 >/dev/null
command -v pm2 >/dev/null || npm install -g pm2
# Redis (shared with other apps is fine — tuli uses its own key prefix "tuli:")
if ! redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG; then
  command -v redis-server >/dev/null || apt-get install -y -qq redis-server >/dev/null
  systemctl enable --now redis-server >/dev/null 2>&1 || systemctl restart redis-server || true
  sleep 1
  if redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG; then echo "Redis running on 127.0.0.1:6379."
  else warn "Redis still not answering on 127.0.0.1:6379 (password or other port?) — set REDIS_URL in apps/api/.env"; fi
else
  echo "Redis OK."
fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<20||(a===20&&b<11)){console.error("Node "+process.versions.node+" is too old — need 20.11+ (22 recommended)");process.exit(1)}'

# ── 3. Database ─────────────────────────────────────────
say "[3/6] Postgres database '$DB_NAME'"
DB_PASS=""
# password from an existing production .env (URL-decoded), so a re-run keeps both in sync
env_db_pass() {
  [ -f "$ENV_FILE" ] || return 0
  python3 - "$ENV_FILE" <<'PY'
import re, sys, urllib.parse
m = re.search(r'^DATABASE_URL="?([^"\n]+)', open(sys.argv[1]).read(), re.M)
if m:
    p = urllib.parse.urlparse(m.group(1)).password
    print(urllib.parse.unquote(p) if p else "")
PY
}
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  EXISTING=""
  grep -q '^NODE_ENV=production' "$ENV_FILE" 2>/dev/null && EXISTING="$(env_db_pass)"
  if [ -n "$EXISTING" ] && [ "$EXISTING" != "CHANGE_ME" ]; then
    sudo -u postgres psql -q -c "ALTER USER $DB_USER WITH PASSWORD '${EXISTING//\'/\'\'}';"
    echo "User $DB_USER exists — password synced with apps/api/.env."
  else
    # no usable .env yet: give the user a fresh password the new .env will carry
    DB_PASS="$(openssl rand -hex 24)"
    sudo -u postgres psql -q -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';"
    echo "User $DB_USER exists — set a new password for the new .env."
  fi
else
  DB_PASS="$(openssl rand -hex 24)"
  sudo -u postgres psql -q -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres psql -q -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -q -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;"

# ── 4. .env ─────────────────────────────────────────────
say "[4/6] apps/api/.env"
if [ -f "$ENV_FILE" ] && grep -q '^NODE_ENV=production' "$ENV_FILE"; then
  echo "Production .env already present — leaving it as is."
else
  [ -n "$DB_PASS" ] || { warn "DB user exists but no production .env — set DATABASE_URL by hand in $ENV_FILE"; DB_PASS="CHANGE_ME"; }
  read -rp "Google OAuth client ID (Enter to skip): " GID
  read -rp "Google OAuth client secret (Enter to skip): " GSECRET
  [ -f "$ENV_FILE" ] && cp "$ENV_FILE" "$ENV_FILE.before-setup"
  cat > "$ENV_FILE" <<ENV
# ── Server ── (written by deploy/setup-server.sh)
NODE_ENV=production
PORT=$PORT
CORS_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
APP_URL=https://$DOMAIN
API_PUBLIC_URL=https://$DOMAIN/api

# ── Database & cache ──
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME?schema=public"
REDIS_URL=redis://127.0.0.1:6379
REDIS_PREFIX=tuli:

# ── Auth ──
JWT_SECRET=$(openssl rand -hex 48)
JWT_EXPIRES_IN=30d
COOKIE_SECURE=true
SIGNUP_ENABLED=true

# ── Google sign-in ── redirect URI in Google Cloud must match exactly
GOOGLE_CLIENT_ID=$GID
GOOGLE_CLIENT_SECRET=$GSECRET
GOOGLE_REDIRECT_URI=https://$DOMAIN/api/auth/google/callback

# ── Email (password resets) — Resend API key; the from-domain must be verified in Resend
RESEND_API_KEY=
RESEND_FROM_NAME=tuli
RESEND_FROM_EMAIL=no-reply@$DOMAIN
MAIL_REPLY_TO=info@nubiannetworks.com

# ── Sign in with Apple ── (leave empty to keep the button disabled)
APPLE_SERVICES_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
APPLE_REDIRECT_URI=https://$DOMAIN/api/auth/apple/callback

# ── Rendering ── empty = the Chrome downloaded by npm install
CHROME_PATH=
RENDER_CONCURRENCY=2

# ── Payments ── Paystack handles cards and M-Pesa (MPESA_GATEWAY=paystack). Mock until PAYSTACK_SECRET_KEY is added:
# ALLOW_MOCK_PAYMENTS=true lets production start with mock payments (anyone can pay for free) — TESTING ONLY:
# set CARD_MODE=live + PAYSTACK_SECRET_KEY and delete ALLOW_MOCK_PAYMENTS before launch.
ALLOW_MOCK_PAYMENTS=true
MPESA_GATEWAY=paystack
MPESA_MODE=mock
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=174379
MPESA_PASSKEY=
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline
MPESA_PARTY_B=
MPESA_CALLBACK_SECRET=$(openssl rand -hex 16)
CARD_MODE=mock
PAYSTACK_SECRET_KEY=

ETIMS_ENABLED=false
ENV
  chmod 600 "$ENV_FILE"
  echo "Wrote $ENV_FILE (port $PORT)."
fi

# ── 5. nginx + HTTPS ────────────────────────────────────
say "[5/6] nginx site for $DOMAIN"
DOMAINS="$DOMAIN"
getent hosts "www.$DOMAIN" >/dev/null && DOMAINS="$DOMAIN www.$DOMAIN"
mkdir -p "$FE_DEPLOY"
if [ ! -f "$SITE" ]; then
  sed -e "s|__DOMAINS__|$DOMAINS|g" -e "s|__ROOT__|$FE_DEPLOY|g" -e "s|__PORT__|$PORT|g" \
    "$REPO/deploy/nginx/tulidocs.conf" > "$SITE"
  ln -sf "$SITE" "/etc/nginx/sites-enabled/$DOMAIN"
  nginx -t && systemctl reload nginx
else
  echo "$SITE already exists — not touching it."
fi
if command -v certbot >/dev/null; then
  if ! grep -q "listen 443" "$SITE"; then
    CERT_ARGS=(); for d in $DOMAINS; do CERT_ARGS+=(-d "$d"); done
    certbot --nginx "${CERT_ARGS[@]}" --non-interactive --agree-tos --redirect --register-unsafely-without-email \
      || warn "certbot failed — check that $DOMAIN points at this server, then run: certbot --nginx ${CERT_ARGS[*]}"
  else
    echo "HTTPS already configured."
  fi
else
  warn "certbot not installed — apt-get install -y certbot python3-certbot-nginx, then: certbot --nginx -d $DOMAIN"
fi

# ── 6. First deploy + admin ─────────────────────────────
say "[6/6] First deploy"
bash "$REPO/deploy.sh" --no-pull
if ! sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT 1 FROM \"User\" WHERE role='SYSTEM_ADMIN' LIMIT 1" | grep -q 1; then
  read -rp "Platform admin email (Enter to skip): " AEMAIL
  if [ -n "$AEMAIL" ]; then
    read -rsp "Admin password (8+ chars): " APASS; echo
    (cd "$REPO/apps/api" && npm run -s create-admin -- "$AEMAIL" "$APASS" "Platform Admin")
  fi
fi

say "Setup complete → https://$DOMAIN   (redeploy later with: bash $REPO/deploy.sh)"
