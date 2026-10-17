# Meta App Review checklist (Podo Social)

Operator checklist before submitting App Review. Paths are relative to this repo.
Do **not** change Meta console settings from this doc — use it to verify the app is ready, then configure the dashboard yourself.

Smoke public URLs after deploy:

```bash
APP_URL=https://<your-domain> pnpm smoke
```

Authenticated flows (magic link, ads) are **manual QA** — see `scripts/smoke-social.ts`.

---

## 1. Support URL

| Item | Value / path |
|------|----------------|
| Public page | `{APP_URL}/support` |
| Implementation | `src/app/(marketing)/support/page.tsx` |
| Copy / contact | `src/modules/marketing/config/legal.ts` |
| Meta field | App settings → Basic → **Support URL** |

Smoke expects HTTP 200 on `/support`.

---

## 2. Data deletion

| Item | Value / path |
|------|----------------|
| Instructions URL (users) | `{APP_URL}/data-deletion` |
| Page | `src/app/(marketing)/data-deletion/page.tsx` |
| User request form | `src/modules/marketing/components/data-deletion-request-form.tsx` |
| Public POST API | `src/app/api/data-deletion/route.ts` |
| Meta callback URL | `{APP_URL}/api/meta/data-deletion` |
| Callback handler | `src/app/api/meta/data-deletion/route.ts` (signed_request → confirmation_code + status URL) |
| Persistence | Prisma `DataDeletionRequest`; worker job via `INTEGRATION_JOB.processDeletionRequest` |
| Meta field | App settings → Basic → **Data deletion instructions URL** + **Data deletion callback URL** |

Smoke expects HTTP 200 on `/data-deletion`. Callback is POST-only (not in smoke).

---

## 3. Privacy / Terms

| Item | URL | Path |
|------|-----|------|
| Privacy Policy | `{APP_URL}/privacy` | `src/app/(marketing)/privacy/page.tsx` |
| Terms | `{APP_URL}/terms` | `src/app/(marketing)/terms/page.tsx` |

Smoke covers `/privacy`. Terms is the same marketing layout; confirm 200 manually if needed.

---

## 4. Webhook callbacks

Configure in Meta App Dashboard → Webhooks (or Graph subscriptions). Handlers already verify `hub.verify_token` and `X-Hub-Signature-256`.

| Object | Callback URL | Handler | Fields (code) |
|--------|--------------|---------|----------------|
| Page | `{APP_URL}/api/webhooks/meta` | `src/app/api/webhooks/meta/route.ts` | `feed`, `messages`, `leadgen` — `PAGE_WEBHOOK_FIELDS` in `src/modules/social/server/integrations/providers/meta/meta-webhook-subscribe.ts` |
| Instagram | same URL | same route (`object=instagram`) | `comments`, `messages` — `INSTAGRAM_WEBHOOK_FIELDS` in same file |
| WhatsApp | `{APP_URL}/api/webhooks/whatsapp` | `src/app/api/webhooks/whatsapp/route.ts` | Cloud API `whatsapp_business_account` (ingest in `whatsapp-webhook.service.ts`) |

App-level subscribe helper (server): `subscribeAppPageAndInstagramWebhooks()` in `meta-webhook-subscribe.ts`.  
Verify token env: `META_WEBHOOK_VERIFY_TOKEN` (see `.env.example`).

Per-Page Graph subscribe: `POST /{page-id}/subscribed_apps` (documented on the meta webhook route).

⚠️ WhatsApp callback may be shared with PodoCRM forwarding (`PODOCRM_WHATSAPP_WEBHOOK_URL`). Do not point Meta at PodoCRM’s webhook; Social owns `/api/webhooks/whatsapp` and forwards.

---

## 5. Permissions list (from providers)

OAuth scopes requested at connect time. Source of truth:

### Facebook Page — `FacebookProvider.scopes`

`src/modules/social/server/integrations/providers/meta/facebook.provider.ts`

- `pages_show_list`
- `business_management`
- `pages_manage_posts`
- `pages_read_engagement`
- `read_insights`
- `pages_read_user_content`
- `pages_manage_engagement`

### Instagram — `InstagramProvider.scopes`

`src/modules/social/server/integrations/providers/meta/instagram.provider.ts`

- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_comments`
- `instagram_manage_insights`
- `pages_show_list`
- `pages_read_engagement`
- `business_management`

### Related (not in FB/IG provider arrays)

| Use | Where | Notes |
|-----|--------|--------|
| Ads read | System user / `META_SYSTEM_USER_TOKEN`; `ads.service.ts` | Needs `ads_read` (and often `ads_management`) on the system user — not user OAuth scopes above |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN` | `whatsapp_business_messaging`, `whatsapp_business_management` — see `whatsapp.service.ts` |
| Broader review list | `scripts/meta-check.ts` → `REQUIRED_SCOPES` | Includes messaging / leads / ads used by inbox & ads; request in App Review only what you demo |

OAuth redirect used by the app:

`{APP_URL}/api/social/integrations/callback/facebook`  
`{APP_URL}/api/social/integrations/callback/instagram`  

Handler: `src/app/api/social/integrations/callback/[provider]/route.ts`.  
Add these under Facebook Login for Business → Valid OAuth Redirect URIs.

Connect start: `src/app/api/social/integrations/connect/[provider]/route.ts`.

---

## 6. Two-factor authentication (2FA)

- Meta requires 2FA on the **admin** Facebook accounts that submit App Review and manage the Business.
- Not implemented in this codebase — enable on each reviewer/admin Facebook account and Business Manager.
- Keep app roles limited; avoid sharing a single non-2FA login for dashboard + App Review.

---

## 7. Domain verification

- App settings → Basic → **App Domains** and Website platform → Site URL = production `{APP_URL}` host.
- Business Manager → Brand Safety / Domain verification for the production hostname if Meta prompts for it (required for some Page/IG features).
- Local/dev: use a tunnel host and add that redirect URI temporarily; remove after.
- Env: `APP_URL` in `.env.example` / deploy secrets must match the HTTPS origin Meta will call.

---

## 8. Video recording tips (screencast for App Review)

Record against **production** (or a stable staging hostname Meta can reach), not localhost.

1. **Connect channels** — Dashboard → Social → Channels (`src/app/(dashboard)/dashboard/social/channels/page.tsx`): connect Facebook Page + Instagram; show the permission dialog listing scopes from §5.
2. **Publish** — Composer / calendar: create a post, schedule or publish to FB + IG (uses `pages_manage_posts` / `instagram_content_publish`).
3. **Insights** — Analytics section so `read_insights` / `instagram_manage_insights` are visibly used.
4. **Engagement / inbox** — Reply to a Page or IG comment/message if reviewing messaging/engagement permissions (`/api/webhooks/meta` ingestion → inbox UI).
5. **Data deletion** — Open `/data-deletion` and show how a user requests deletion; mention Meta callback at `/api/meta/data-deletion`.
6. **Support** — Open `/support` briefly so Support URL is real.
7. Keep the screencast continuous, no password paste, no other clients’ data. Use a dedicated test Page/IG Business account.

Graph usage counters: `pnpm meta:check` (`scripts/meta-check.ts`) with `META_TEST_USER_TOKEN` — read-only; helps populate App Review usage before submit.

---

## 9. Quick verify matrix

| Check | How |
|-------|-----|
| Public pages + health | `APP_URL=… pnpm smoke` |
| Health / ready | `GET /api/health`, `GET /api/health/ready` |
| Meta Graph / scopes debug | `pnpm meta:check` |
| Manual: magic link | Client magic-link routes under `src/app/api/social/clients/[id]/magic-link/` + approver portal |
| Manual: ads | Dashboard Social → Ads; system user token |

Do not commit secrets. Do not flip Live mode until Support, Privacy, Data deletion, and webhook callbacks all return successfully from the public hostname.
