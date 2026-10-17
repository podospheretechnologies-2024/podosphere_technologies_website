#!/usr/bin/env bash
# Dump the local Docker MySQL (podosphere-mysql, host port 3307) to ./backups/.
# Usage: ./scripts/backup-mysql.sh
# Env overrides: MYSQL_CONTAINER, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, BACKUP_DIR

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${MYSQL_CONTAINER:-podosphere-mysql}"
DATABASE="${MYSQL_DATABASE:-podo_social}"
USER="${MYSQL_USER:-podo}"
PASSWORD="${MYSQL_PASSWORD:-podo}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required (mysqldump runs inside the MySQL container)." >&2
  exit 1
fi

if [[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)" != "true" ]]; then
  echo "Container '$CONTAINER' is not running. Start with: docker compose up -d mysql" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/${DATABASE}_${STAMP}.sql"

echo "Dumping $DATABASE from $CONTAINER -> $OUT"
docker exec "$CONTAINER" mysqldump \
  -u"$USER" \
  -p"$PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  --databases "$DATABASE" \
  >"$OUT"

if [[ ! -s "$OUT" ]]; then
  echo "Backup looks empty or missing: $OUT" >&2
  exit 1
fi

echo "OK: $OUT ($(wc -c <"$OUT") bytes)"
