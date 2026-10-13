#!/usr/bin/env bash
# One-time update of the live nginx site for tulidocs.com (safe to run again — it skips if already applied).
#  1. Pages and their data files are always re-checked → nobody keeps running an old build after a deploy.
#  2. If a browser ever opens a page's data file (…/index.txt) as a page, it is sent to the real page
#     instead of showing raw text (Next.js falls back to that URL when a page fetch fails on a bad connection).
# Usage: sudo bash deploy/patch-nginx-rsc.sh [/etc/nginx/sites-available/tulidocs.com]
set -euo pipefail
SITE="${1:-/etc/nginx/sites-available/tulidocs.com}"
[ -f "$SITE" ] || { echo "Not found: $SITE"; exit 1; }
if grep -q 'index\\\.txt' "$SITE"; then echo "Already applied to $SITE"; exit 0; fi

cp "$SITE" "$SITE.bak.$(date +%Y%m%d%H%M%S)"
python3 - "$SITE" <<'PY'
import re, sys
path = sys.argv[1]
s = open(path).read()
pattern = re.compile(r'(\n([ \t]*)location / \{\n[ \t]*try_files \$uri \$uri/ \$uri\.html =404;\n)([ \t]*\}\n)')
def repl(m):
    head, ind, close = m.group(1), m.group(2), m.group(3)
    i2 = ind + '    '
    return (head + f'{i2}add_header Cache-Control "no-cache" always;\n' + close +
            f'\n{ind}# a page\'s data file opened as a page (failed fetch on a bad connection, restored tab, old link) → the real page\n'
            f'{ind}location ~ ^(?<page>.*/)index\\.txt$ {{\n'
            f'{i2}if ($http_sec_fetch_dest = "document") {{\n{i2}    return 302 $page;\n{i2}}}\n'
            f'{i2}add_header Cache-Control "no-cache" always;\n'
            f'{i2}try_files $uri =404;\n'
            f'{ind}}}\n')
s2, n = pattern.subn(repl, s)
if n == 0:
    sys.exit('Could not find the "location / { try_files $uri $uri/ $uri.html =404; }" block — edit by hand (see deploy/nginx/tulidocs.conf).')
open(path, 'w').write(s2)
print(f'Updated {n} server block(s) in {path}')
PY

if nginx -t; then
  systemctl reload nginx
  echo "nginx reloaded ✓"
else
  echo "nginx config test failed — restoring the backup"
  cp "$(ls -t "$SITE".bak.* | head -1)" "$SITE"
  exit 1
fi
