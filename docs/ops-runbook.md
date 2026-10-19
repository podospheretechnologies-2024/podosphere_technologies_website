# Ops runbook (Podosphere)

Short notes for uptime, backups, and the background worker. Dev stack: Next on **:4000**, MySQL **:3307**, Redis **:6381** (`docker compose up -d`).

## Health URLs

| Probe | URL | Meaning |
|-------|-----|---------|
| Liveness | `GET /api/health` | Process up — `{ "status": "ok" }`. No auth. |
| Readiness | `GET /api/health/ready` | MySQL `SELECT 1` + Redis `PING`. Soft degrade: body always includes `checks`; **503** if DB or Redis is down. Optional `queues` (BullMQ `getJobCounts` for main queues) when Redis is up. No auth. |

```bash
curl -s http://localhost:4000/api/health
curl -s http://localhost:4000/api/health/ready
```

Point an external uptime check at liveness. Use readiness for deploy gates / deeper monitors.

## Worker must run

Publishing, automation, analytics, ads sync, integrations, alerts, reports, and AI weekly plan all go through BullMQ. The Next.js app enqueues jobs; **`pnpm worker`** must be running or queues back up and nothing publishes.

```bash
pnpm worker
# starts src/worker/index.ts (all social workers)
```

If `/api/health/ready` shows growing `waiting` / `delayed` counts, check that the worker process is alive and Redis is reachable.

## Backup

```bash
pnpm db:backup
# Windows: scripts/backup-mysql.ps1
# Unix:    scripts/backup-mysql.sh
```

Writes `./backups/podo_social_YYYYMMDD-HHMMSS.sql` via `mysqldump` inside `podosphere-mysql`. See `scripts/restore-mysql.md` for restore and a drill checklist.

## Restore drill (summary)

1. `pnpm db:backup`
2. Stop app + worker
3. Restore dump into `podosphere-mysql` (root user; see restore doc)
4. Start app + worker; confirm both health endpoints
5. Spot-check login / one client view

Full commands: [`scripts/restore-mysql.md`](../scripts/restore-mysql.md).

## Razorpay billing

Checkout and GST invoices need these env vars (values from the Razorpay dashboard — do not invent or commit secrets):

| Env | Required for | Notes |
|-----|--------------|--------|
| `RAZORPAY_KEY_ID` | Checkout | Key ID |
| `RAZORPAY_KEY_SECRET` | Checkout + API | Key secret |
| `RAZORPAY_WEBHOOK_SECRET` | `/api/webhooks/razorpay` | Webhook signing secret |
| `RAZORPAY_PLAN_SOLO` | Subscription mode | Plan ID for Solo |
| `RAZORPAY_PLAN_AGENCY_STARTER` | Subscription mode | Plan ID for Agency Starter |
| `RAZORPAY_PLAN_AGENCY_GROWTH` | Subscription mode | Plan ID for Agency Growth |
| `RAZORPAY_PLAN_AGENCY_PRO` | Subscription mode | Plan ID for Agency Pro |
| `BILLING_SELLER_GSTIN` | GST invoice PDF | Optional until live |
| `BILLING_SELLER_STATE` | CGST/SGST vs IGST | Optional 2-digit state code |
| `BILLING_GST_PERCENT` | Tax split | Default `18` |

Without `RAZORPAY_PLAN_*`, billing creates a one-time **order**. With plan IDs set, it creates a real Razorpay **subscription**.

Webhook URL: `{APP_URL}/api/webhooks/razorpay`

Enable at least: `payment.captured`, `order.paid`, `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`.

Status on `SocialSubscription`: charged/activated → `active`; halted → `past_due` (org downgraded to Solo); cancelled → `cancelled` (org downgraded to Solo).
