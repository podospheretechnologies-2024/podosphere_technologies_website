# Podo Social — Pending Changes (17 Oct 2026)

All planned **code** from the client-scope / P1–P3 / ops waves is in the working tree.

---

## 1. Status

**Local:** `pnpm vitest run src/shared/server` · `tsc --noEmit` · Prisma migrations applied through `20261017250000_org_custom_domain`.

**Not committed / not deployed to staging-prod yet.**

### Delivered
Client scope & security · Ads · Approvals · PDF reports + Resend · Templates/onboarding · Inbox SLA/leads · AI weekly plan · White-label + custom domain (Caddy ask) · Razorpay + GST invoice PDF · WA broadcast consent · Health/backup/smoke · Meta App Review checklist doc

### Key commands
| Command | Purpose |
|---------|---------|
| `pnpm db:deploy` | Apply migrations |
| `pnpm db:backfill-clients --apply` | Client scope backfill |
| `pnpm worker` | Queues (PDF, email, SLA, AI, webhooks) |
| `pnpm smoke` | Public URL smoke (`APP_URL=…`) |
| `pnpm db:backup` | MySQL dump → `./backups/` |
| `pnpm db:audit-orgs` | List orgs/users (read-only) |

Docs: `docs/META_APP_REVIEW.md`, `docs/ops-runbook.md`, `deploy/Caddyfile.on-demand.example`

---

## 2. You still need to do

- [ ] **Commit** this branch
- [ ] Staging/prod: migrate → backfill → deploy **app + worker**
- [ ] Env: `RESEND_API_KEY`, Razorpay keys, Meta tokens as needed
- [ ] Meta Business Manager: App Review, 2FA, domain, webhook URLs
- [ ] Point DNS + Caddy if using custom domains
- [ ] Product pricing / packaging decisions

---

## 3. Next
Reply **commit** to create the git commit, then deploy.
