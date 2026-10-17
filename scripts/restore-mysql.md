# MySQL restore (Docker, port 3307)

Local stack from `docker-compose.yml`:

| Item | Value |
|------|--------|
| Container | `podosphere-mysql` |
| Host port | `3307` → container `3306` |
| Database | `podo_social` |
| App user | `podo` / `podo` |
| Root | `root` / `root` |
| Dump script | `pnpm db:backup` → `./backups/podo_social_*.sql` |

Backups are written under `./backups/` (gitignored). Prefer restoring into a **stopped app + worker** so nothing writes mid-import.

## Prerequisites

```bash
docker compose up -d mysql
# wait until healthy
docker compose ps
```

## Restore a dump

Dumps from `scripts/backup-mysql.*` use `--databases`, so they recreate `podo_social` and switch into it.

**PowerShell (Windows):**

```powershell
$dump = "backups\podo_social_YYYYMMDD-HHMMSS.sql"   # pick a real file
Get-Content $dump -Raw | docker exec -i podosphere-mysql mysql -uroot -proot
```

**Bash:**

```bash
DUMP=backups/podo_social_YYYYMMDD-HHMMSS.sql
docker exec -i podosphere-mysql mysql -uroot -proot < "$DUMP"
```

Using root avoids privilege issues if the dump includes `CREATE DATABASE` / grants.

## Verify

```bash
docker exec podosphere-mysql mysql -upodo -ppodo -e "SHOW TABLES;" podo_social
# then
curl -s http://localhost:4000/api/health/ready
```

## Drill checklist

1. Take a fresh backup: `pnpm db:backup`
2. Note row counts for a couple of tables (optional sanity check)
3. Stop Next.js and `pnpm worker`
4. Restore the dump (commands above)
5. Start app + worker; hit `/api/health` and `/api/health/ready`
6. Spot-check login and one client-scoped page

## Notes

- Host clients (Prisma, GUI) use `localhost:3307`; `mysqldump`/`mysql` inside Docker use the container hostname and port `3306`.
- Do not commit dump files. Rotate or delete old files under `backups/` as needed.
- Production restore should use the same pattern against the real container/host with secrets from the environment, not the compose defaults.
