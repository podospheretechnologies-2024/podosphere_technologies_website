#!/usr/bin/env bash
# Run on the 2GB Lightsail host after a laptop `build:deploy` was pushed to main.
# Does NOT run next build — uses committed deploy/standalone.
set -euo pipefail

cd /var/www/podo-social

echo "==> git pull"
git pull --ff-only

echo "==> pnpm install (no build)"
pnpm install --frozen-lockfile

echo "==> db migrate (safe)"
pnpm db:deploy

echo "==> replace web process (must delete — reload keeps old next start)"
pm2 delete podo-social-web 2>/dev/null || true
pm2 delete podo-social-worker 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "==> verify web entry (must be run-standalone-web.cjs, NOT next start)"
pm2 show podo-social-web | sed -n '1,40p'

echo "==> recent web logs (should NOT mention next start warning)"
pm2 logs podo-social-web --lines 20 --nostream
