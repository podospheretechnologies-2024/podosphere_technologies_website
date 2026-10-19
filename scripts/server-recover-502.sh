#!/usr/bin/env bash
# Bring the site back when nginx shows 502 (nothing on :3100).
# Uses next start + laptop-packed .next (native modules come from Linux pnpm install).
set -euo pipefail
cd /var/www/podo-social

echo "==> git pull"
git pull --ff-only

echo "==> install deps if needed (Linux natives)"
pnpm install --frozen-lockfile

echo "==> sync packed .next from deploy/standalone (no build on this host)"
if [[ ! -f deploy/standalone/.next/BUILD_ID ]]; then
  echo "ERROR: deploy/standalone/.next missing — pull latest main (laptop build:deploy)."
  exit 1
fi
rm -rf .next
mkdir -p .next
cp -a deploy/standalone/.next/. .next/
node scripts/link-turbopack-externals-shim.mjs

echo "==> restart pm2 (next start on :3100)"
pm2 delete podo-social-web 2>/dev/null || true
pm2 delete podo-social-worker 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "==> verify"
sleep 2
ss -lptn 'sport = :3100' 2>/dev/null || true
curl -s -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3100/api/health || true
pm2 list
pm2 logs podo-social-web --lines 20 --nostream
