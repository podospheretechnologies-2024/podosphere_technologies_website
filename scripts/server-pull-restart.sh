#!/usr/bin/env bash
# Deploy without building on the 2GB host:
# 1) git pull (includes laptop `pnpm build:deploy` → deploy/standalone/.next)
# 2) copy that .next into repo root
# 3) pm2 next start (uses Linux node_modules — avoids Windows standalone crash / 502)
set -euo pipefail

cd /var/www/podo-social

echo "==> git pull"
git pull --ff-only

echo "==> pnpm install (no build)"
pnpm install --frozen-lockfile

echo "==> db migrate (safe)"
pnpm db:deploy || true

echo "==> sync .next from packed standalone"
if [[ ! -f deploy/standalone/.next/BUILD_ID ]]; then
  echo "ERROR: missing deploy/standalone/.next — run build:deploy on a laptop and push main."
  exit 1
fi
rm -rf .next
mkdir -p .next
cp -a deploy/standalone/.next/. .next/
echo "BUILD_ID=$(cat .next/BUILD_ID)"

echo "==> restart pm2"
pm2 delete podo-social-web 2>/dev/null || true
pm2 delete podo-social-worker 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "==> verify :3100"
sleep 2
curl -s -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:3100/api/health || true
pm2 show podo-social-web | sed -n '1,35p'
pm2 logs podo-social-web --lines 15 --nostream
