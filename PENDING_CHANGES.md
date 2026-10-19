# Podo Social — Pending Changes (18 Oct 2026)

**Authoritative done/pending:** `SOCIAL_PENDING.md`.

Verified: `tsc --noEmit` ✅ · `vitest` 7 files / 68 tests ✅ · `prisma validate` ✅ · **41** migrations.

---

## Done (working tree — not committed yet)

### Prior waves
Client scope, switcher, overview, templates, onboarding, approvals/portal, reports PDF+email, white-label, billing/GST, public API, health/backup/smoke.

### This wave (Sprint 1 + features)
| Area | IDs |
|---|---|
| AI | A1–A6, A5/F7, F1–F4, F13 |
| Meta sync | M1–M8, F8, F14, F16 |
| Inbox / leads | I1–I5, F5, F6 |
| Composer | P1/F9, P2, P3, P4/F11, P5 Threads |
| Billing / ops | B1, B2/F12, B3 |
| Other | F10 short links, F15 WA auto-replies, F2 branded templates |

---

## Still pending

### You (ops / Meta) — not code
- [ ] **Commit** this wave
- [ ] Staging/prod: `pnpm db:deploy` → `pnpm db:backfill-clients --apply` → deploy **app + worker**
- [ ] Env: Resend, Razorpay plan IDs, AI keys, Pinterest, Threads
- [ ] Meta App Review + Advanced Access + reconnect channels for new scopes
- [ ] Page/IG webhooks on production
- [ ] Decide fate of `deploy/standalone/` on `main`

### Optional code (later)
- [ ] Copilot SSE streaming
- [ ] Canva OAuth
- [ ] X / TikTok providers

---

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm db:deploy` | Apply migrations |
| `pnpm db:backfill-clients --apply` | Client scope backfill |
| `pnpm worker` | Queues |
| `pnpm smoke` | Public URL smoke (`APP_URL=…`) |
| `pnpm db:backup` | MySQL dump |

Docs: `SOCIAL_PENDING.md` · `docs/META_APP_REVIEW.md` · `docs/ops-runbook.md`

---

## Next

Reply **commit** to create the git commit, then deploy.
