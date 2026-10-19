# Podo Social — Pending Changes (19 Oct 2026)

**Authoritative done/pending:** `SOCIAL_PENDING.md`.

---

## Done in working tree (this pass)

| Fix | Detail |
|---|---|
| `/admin` 401 → login | `(admin)/layout.tsx` redirects unauthenticated users to `/login` (no more “This page couldn't load”) |
| PM2 standalone start | `ecosystem.config.cjs` runs `scripts/run-standalone-web.cjs` (loads repo `.env`, then `deploy/standalone/server.js`) |
| Docs | `ARCHITECTURE.md` production steps updated |

---

## Still pending (ops — not code)

- [ ] **Pull `main` on the server** (standalone already packed locally — no build on 2GB host)
- [ ] **`pm2 delete podo-social-web && pm2 start ecosystem.config.cjs && pm2 save`** once to leave `next start`
- [ ] `pnpm install` + `pnpm db:deploy` if needed (no `pnpm build`)
- [ ] Reconnect channels marked `refreshNeeded` (dashboard → Channels)
- [ ] Siyara Beauty ad account in Meta BM (`Invalid parameter`)
- [ ] Meta App Review + webhooks + env (Resend / Razorpay plans / AI)
- [ ] Platform admin user: ensure `users.isPlatformAdmin = true` for your login

### Optional code (later)

- [ ] Copilot SSE / Canva / X / TikTok

---

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm build:deploy` | Build + pack `deploy/standalone` |
| `pnpm start:standalone` | Local/prod-like web entry |
| `pm2 start ecosystem.config.cjs` | Web + worker |
| `pnpm db:deploy` | Migrations |
| `pnpm smoke` | Public URL smoke |

Docs: `SOCIAL_PENDING.md` · `docs/META_APP_REVIEW.md` · `docs/ops-runbook.md` · `ARCHITECTURE.md`
