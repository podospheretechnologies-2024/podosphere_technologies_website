# Podo Social — Status (done vs pending)

> **Updated 19 Oct 2026.** Source of truth for ship status after the multi-agent wave + prod hardening.
> Older narrative plans (`PODO_SOCIAL.md`, `PODO_SOCIAL_CLIENT_PLAN.md`) may still describe historical gaps — prefer **this file** + `PENDING_CHANGES.md`.
> Read `AGENTS.md` before writing code (Next.js 16).

Legend: ✅ done in working tree · 🟡 partial / needs ops · ❌ not started · 🔒 outside code (Meta/ops)

---

## 0. Health check

| Check | Result |
|---|---|
| Feature wave on `main` | ✅ committed (`cc64eae` + follow-ups) |
| `/admin` unauthenticated | ✅ layout redirects to `/login` (was 500) |
| PM2 web entry | ✅ `scripts/run-standalone-web.cjs` (no `next start` warning) |
| Migrations | **41** (latest `20261018194000_ai_copilot_agent`) |
| `deploy/standalone/` | 🟡 rebuild/pack after this pass before prod sees admin layout |
| Live tokens / Meta | 🟡 reconnect `refreshNeeded` channels; fix Siyara BM account |

---

## 1. Already built (core product)

| Area | Status |
|---|---|
| Composer, calendar, drafts, schedule, tags, signatures, sets | ✅ |
| Providers: FB, IG, LinkedIn, YouTube, GBP, **Threads**, **Pinterest** | ✅ |
| Automation: RSS, webhooks, Google Sheets | ✅ |
| Client scope + switcher, overview, templates, onboarding | ✅ |
| Approvals + client portal | ✅ |
| Reports PDF + Resend + AI narrative | ✅ |
| Inbox (assign/SLA) + **reply / hide / triage / saved replies** | ✅ |
| Leads pipeline + **score + PodoCRM push** | ✅ |
| AI: posts, URL, thread, image presets, brand kit (per-client), weekly plan, **copilot agent** | ✅ |
| WhatsApp inbox/templates/broadcasts + **keyword auto-replies** | ✅ |
| Billing Razorpay + GST PDF + plan limits + halt/cancel webhooks | ✅ |
| White-label + custom domain Caddy ask | ✅ |
| Public `/api/v1`, health, backup/smoke docs | ✅ |
| Ads: per-account tokens, campaigns/adsets/ads sync, creative helper (draft-only) | ✅ |
| Analytics: pagination, stories, backfill, best-times, competitor media | ✅ |

---

## 2. Code backlog — status

### 2.1 AI

| # | Item | Status |
|---|---|---|
| A1–A3 | Client brand kit + scope + client media for AI images | ✅ |
| A4 | AI usage `customerId` + billing breakdown + soft per-client cap | ✅ |
| A5 / F7 | Copilot multi-turn + tools + pending actions | ✅ (JSON turns; **no SSE** yet) |
| A6 | Model pricing map | ✅ |
| A7 / F1 | Image style + platform size presets | ✅ |
| — | Copilot SSE streaming | ❌ optional |
| — | Second image provider / Canva OAuth | ❌ optional |

### 2.2 Meta analytics & ads

| # | Item | Status |
|---|---|---|
| M1 | Per-`AdAccount` encrypted token | ✅ |
| M2 | Sync ad sets + ads | ✅ |
| M3 | `graphGetAll` pagination | ✅ |
| M4 | Stories (4h) + 90d backfill | ✅ |
| M5 | Rate-limit / usage headers + backoff | ✅ |
| M6 | Account timezone for insight dates | ✅ |
| M7 | Zod soft-parse Graph shapes | ✅ |
| M8 | Daily reach / impressions / profile views / clicks | ✅ |

### 2.3 Inbox & leads

| # | Item | Status |
|---|---|---|
| I1 | Reply FB/IG comments + DMs | ✅ (needs App Review scopes live) |
| I2 | Hide comment | ✅ |
| I3 / F5 | AI triage + draft | ✅ |
| I4 / F6 | Lead score + PodoCRM push | ✅ |
| I5 | Saved replies | ✅ |

### 2.4 Composer & publishing

| # | Item | Status |
|---|---|---|
| P1 / F9 | Repeat / evergreen recurrence | ✅ |
| P2 | Pinterest provider | ✅ |
| P3 | First comment after publish | ✅ |
| P4 / F11 | Bulk CSV schedule | ✅ |
| P5 | Threads | ✅ |
| — | X / TikTok | ❌ not started |

### 2.5 Billing & ops (code)

| # | Item | Status |
|---|---|---|
| B1 | Razorpay `charged` / `halted` / `cancelled` | ✅ (plan IDs still need env) |
| B2 / F12 | Notifications + email hooks + shell bell | ✅ |
| B3 | Expanded Vitest (webhooks, API key, approvals) | ✅ |

### 2.6 Features F1–F16

| ID | Feature | Status |
|---|---|---|
| F1 | Image presets | ✅ |
| F2 | Branded SVG→PNG templates | ✅ |
| F3 | Caption tone presets | ✅ |
| F4 | India festival calendar | ✅ |
| F5 | Inbox AI triage | ✅ |
| F6 | Lead score + CRM | ✅ |
| F7 | Copilot agent | ✅ |
| F8 | Best time to post | ✅ |
| F9 | Recurrence / evergreen | ✅ |
| F10 | UTM short links `/l/[code]` | ✅ |
| F11 | CSV bulk import | ✅ |
| F12 | Notifications centre | ✅ |
| F13 | Media vision alt + sharp resize | ✅ (no Canva) |
| F14 | Ads creative helper (draft only) | ✅ |
| F15 | WA keyword auto-replies | ✅ |
| F16 | Competitor recent media + AI summary | ✅ |

---

## 3. Still pending — outside the code (Meta / ops / business)

| Pri | Item | Owner |
|---|---|---|
| 🔴 | Meta App Review — Advanced Access (Pages, IG, WhatsApp, Ads, Leads) | Founder / dev |
| 🔴 | Token scopes: `read_insights`, `instagram_manage_*`, `pages_manage_engagement`, messaging scopes | Dev |
| 🔴 | App settings: data-deletion URL, support URL, verify contact email; BM 2FA + domain | Founder |
| 🟠 | Subscribe Page + IG webhooks → `/api/webhooks/meta` on prod | Dev |
| 🟠 | Staging/prod: `pnpm db:deploy` → `pnpm db:backfill-clients --apply` → `pnpm build:deploy` → **pm2 reload** (standalone entry) | Dev |
| 🟠 | Env: `RESEND_API_KEY`, Razorpay + `RAZORPAY_PLAN_*`, AI keys, Pinterest, Threads | Dev |
| 🟠 | Reconnect integrations marked `refreshNeeded`; fix Siyara Beauty Meta ad account | Founder / Dev |
| 🟠 | Real WhatsApp templates (beyond `hello_world`); Tech Provider | Founder |
| 🟠 | Monitoring + **tested** restore | Dev |
| 🟡 | Pricing / packaging; pilots | Founder |
| 🟡 | Commit + ship this hardening pass (`/admin` layout + ecosystem standalone) | Dev |

See also: `docs/META_APP_REVIEW.md`, `docs/ops-runbook.md`.

---

## 4. Repo hygiene still open

- 🟠 `deploy/standalone/` committed on `main` — prefer CI artifact or a `deploy` branch (human decision).
- 🟡 Keep `PODO_SOCIAL.md` / `PODO_SOCIAL_CLIENT_PLAN.md` as history; don’t treat their “missing” tables as current.

---

## 5. Commands

| Command | Purpose |
|---|---|
| `pnpm db:deploy` | Apply migrations |
| `pnpm db:backfill-clients --apply` | Client scope backfill |
| `pnpm worker` | BullMQ workers |
| `pnpm smoke` | Public URL smoke |
| `pnpm db:backup` | MySQL dump |

---

## 6. Open product decisions (not blockers)

- [ ] Image provider: OpenAI only vs second provider
- [ ] Custom presets shareable across clients by default?
- [ ] Text-on-image: satori vs Canva later
- [ ] Per-client AI caps vs agency-only budget (soft caps exist)
- [ ] Where `deploy/standalone` lives
