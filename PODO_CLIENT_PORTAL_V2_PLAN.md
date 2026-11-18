# Client Portal v2 plan — same tabs as admin, client's data only, admin controls it

Written 2026-11-17. Status: **Phases 1–5 done and mostly deployed/committed** (Inbox, Agent, Plugs,
Media/Growth view, Can-act actions, Portal control). WhatsApp + Growth desks can act (see
`PODO_PORTAL_WHATSAPP_GROWTH_PLAN.md`). **Phase 6 phone-width pass done 2026-11-18.** Save-as-default
(`Organization.portalTabDefaults`) landed 2026-11-18. Deploy only on request. Build with
`/client-portal`.
Follows `PODO_CLIENT_PORTAL_PLAN.md` (phases 1–5 done: login, `/portal` shell, 11 tabs, on/off toggles).

## 1. What the user asked

1. The client side should look and work like the admin dashboard: **all tabs on the left side**, same
   screens, same functions.
2. It shows **only that client's data**.
3. The **admin controls it from a UI** (no code change to give or remove a tab).

## 2. Where we are today

| Thing | Today | Gap |
|---|---|---|
| Look | `/portal` uses admin-style shell (`portal-shell.tsx` + shared `IconRail`), theme tokens, Light/Dark switch, phone top bar + bottom bar | Dark mode polish on edge panels if anything still looks off |
| Tabs | Same ids as before; labels match admin (Calendar, Media, Integrations, Growth). **Inbox, Plugs, Agent** exist (Agent off by default). Billing skipped | Billing only if we ever bill clients in-app |
| Functions | View + Can act where planned: approve/notes/request post, inbox reply, lead stage, media upload, WhatsApp reply/send, Growth campaign/blog act | Agency still owns publish/spend; stay that way |
| Admin control | Clients → **Portal control**: Hidden / View / Can act, up/down order, live menu preview, Open as client, Copy to other clients, **Save as default**, WhatsApp reminders | Drag reorder not required (up/down is enough) |
| Data safety | Every portal service filters by session `customerId` + `organizationId`, with isolation tests | Keep exactly this |
| Phone | Phase 6 pass: no horizontal page scroll; tab bars scroll-x; tables → stacked cards under `sm:`; chat list/detail stack on narrow screens | Re-check after large new desk UI |

## 3. Tab map (admin tab → client tab)

| Admin tab | Client tab | Today | v2 work |
|---|---|---|---|
| Overview | Overview | **done** | Same stat tiles as admin (posts due, waiting approval, leads, inbox waiting, ad spend if visible, followers) — session client only |
| Calendar | Calendar | exists as "Content" | Rename. Same month view as admin. Act: approve / ask changes / request a post |
| Agent | Agent | missing | New, off by default (AI cost). Chat limited to this client's data |
| Analytics | Analytics | exists | Restyle only |
| Media | Media | partly ("Brand kit") | Merge: client's media library + brand kit. Act: upload |
| Plugs | Plugs | missing | New, off by default. View auto-reply rules for own channels |
| Integrations | Integrations | exists as "Channels" | Rename. Act: reconnect own channels |
| WhatsApp | WhatsApp | exists | Restyle only |
| Growth | Growth | partly ("Sales") | Merge Sales into Growth (Shopify + GA4 for this client) |
| Client Desk | Requests | exists | Restyle only |
| Ads | Ads | exists | Restyle only. Spend still follows "show ad spend" |
| Inbox | Inbox | missing | New. Comments + DMs of own channels. Act: reply |
| Leads | Leads | exists | Act: change lead status |
| Reports | Reports | exists | Restyle only |
| Billing | Billing | missing | Later, only if we bill clients inside the app. Hidden for now |
| Settings / Clients / API | — | — | **Agency only. Never in the portal.** Client gets a small "Account" page (password) |

## 4. Design

### 4.1 Same look
- New `ClientPortalShell` built from the admin pieces: `IconRail` (takes a nav list instead of the
  fixed `socialAppNav`), same header, light/dark switch, notifications bell.
- Header shows the client name instead of the client switcher. No "All clients" option exists.
- Agency logo + colour stay (white-label).
- Phone width: rail becomes the bottom bar + menu (already in the current portal shell).

### 4.2 Same screens, safe data
- **Reuse the admin display components** (cards, tables, calendar, charts) by passing data in as props.
- **Do not reuse admin APIs.** The portal keeps its own `/api/portal/*` routes and
  `portal-<tab>.service.ts` files. Client id comes only from `getPortalSession()`.
  Reason: admin APIs trust a client id sent by the browser; a client login must never be able to send one.
- Responses stay small portal shapes (no tokens, ad account ids, staff notes, cost/margin).

### 4.3 Admin control (UI)
New page: **Clients → (client) → Portal control** (`/dashboard/social/clients/[id]/portal`).
It replaces the checkbox list in the modal.

- Left: list of all client tabs. For each tab:
  - **Access level: Hidden / View only / Can act**
  - drag to change order
  - hint when the tab needs a connection (Ads, Growth, WhatsApp)
- Extra switches: show ad spend, show Agent, show Billing.
- Right: **live preview** of the client's left menu, and a "Open as client" button (uses the existing
  `agencyPreview` login).
- Buttons: **Copy these settings to other clients**, **Save as default for new clients**.

Storage: keep `SocialCustomer.portalTabs` (Json, no migration). New shape, old shape still read:

```ts
{
  tabs: { inbox: 'act', ads: 'view', agent: 'off' },   // old: true/false still works
  order: ['overview', 'calendar', 'inbox'],
  adSpendVisible: true
}
```
Org default lives in one new Json field `Organization.portalTabDefaults` (one small migration).

### 4.4 Enforcing it on the server
- Pages: `requirePortalPage(tabId)` already redirects when a tab is off. Keep.
- APIs: new `requirePortalTab(tabId, 'view' | 'act')`. Every `/api/portal/*` route calls it.
  A write route with level `view` returns 403. Hiding a button in the UI is not enough.

## 5. Phases

**Phase 1 — Same look (no data change)** ✅ built 2026-11-17
- `IconRail` accepts a nav list. New `ClientPortalShell`. Swap it in for `PortalShell`.
- Rename tabs to match admin (Content→Calendar, Channels→Integrations, Sales→Growth, Brand kit→Media).
  Old URLs redirect.
- Check: every existing tab still works at desktop and phone width.

**Phase 2 — Admin control page** ✅ built 2026-11-17
- Access levels + order in `portal-tabs.ts` (`parsePortalTabsConfig` reads old and new shape).
- Portal control page with preview, copy to other clients, org default.
- `requirePortalTab` guard added to all existing `/api/portal/*` and `/api/approver/*` routes.
- Tests: level `view` blocks writes; client A's settings never change client B.

**Phase 3 — Missing tabs (view level)**
- Inbox, Media, Growth (with GA4). One service + page + isolation test each.
- ✅ Inbox (view): `portal-inbox.service` lists comments/DMs for session client (+ legacy
  channel join); `GET /api/portal/inbox` + `[threadId]`; panel opens thread detail;
  isolation in `portal-inbox-isolation.test.ts`.
- ✅ Media (view): `portal-brand.service` lists this client's SocialMedia library + brand kit;
  panel merges both; isolation in `portal-brand-isolation.test.ts`.
- ✅ Growth (view): `portal-sales.service` adds portal-safe GA4 website totals (via
  `ga4Service.website`); panel shows Shopify + GA4; isolation covers GA4/Shopify scope.

**Phase 4 — "Can act" actions**
- Inbox reply, lead status change, media upload, request a post from Calendar.
- Each action checks level `act` on the server and is written to the audit log with the approver id.
- ✅ Lead status: `PATCH /api/portal/leads/[id]/stage` + `portalLeadsService.updateStage` (session
  org+customer only, `LEAD_STAGES`, audit `portal.lead_stage` with `approverId`).
- ✅ Request a post (Calendar): `POST /api/portal/content/request-post` with
  `requirePortalTab('content','act')`; creates `SocialPortalRequest` type `post`; audit
  `portal.request_post`.
- ✅ Media upload: `POST /api/portal/brand/media` uses `requirePortalTab('brand','act')`, stores
  under session customer only, audits with `approverId` (`portal.media_upload`).
- ✅ Inbox reply: `POST /api/portal/inbox/[threadId]/reply` + `portalInboxService.reply`
  (forced client scope + audit `portal.inbox.reply` with `approverId`); panel shows reply
  box when `canAct`.

**Phase 5 — Optional tabs**
- ✅ Plugs (view): `portal-plugs.service` — WhatsApp auto-replies + auto-posts for this
  customer only (org-wide `customerId` null excluded); `GET /api/portal/plugs`;
  `/portal/plugs`; isolation in `portal-plugs-isolation.test.ts`.
- Agent (scoped chat, off by default) ✅ built 2026-11-17 — `portal-agent.service.ts`,
  `/api/portal/agent/*`, `/portal/agent`, isolation test. Feature tag `portal-agent`. Billing skipped.
- Billing — skipped (decision #4).

**Phase 6 — Finish**
- ✅ Full portal isolation suite: 67 tests passing (2026-11-17).
- ✅ Save as default for new clients (`Organization.portalTabDefaults`, portal control button,
  createClient / bulk-assign copy) — 2026-11-18.
- ✅ Phone-width pass (2026-11-18): shell full-width / no page overflow; Inbox + WhatsApp + Agent
  list/detail stack; Growth/Ads tables → stacked cards under `sm:`; tab bars scroll-x; touch-friendly
  Calendar / Leads / Media / Integrations controls.
- Deploy only on request.

## 5b. What was built (2026-11-17) and what changed from the plan

- `portal-shell.tsx` now uses the admin layout: shared `IconRail` (takes `items`), header with the
  client's name, agency colour as the accent. **Light theme only** — the portal panels still use
  fixed light colours, so dark mode needs a recolour of the 12 panels first.
- **2026-11-18 same look as admin:** all portal panels now use the admin theme colours
  (`bg-surface`, `border-border`, `text-muted-foreground`…) instead of fixed grey/white. The portal
  header has the admin Light / Dark switch (opens light, choice kept in the browser), pages are
  full width like admin, Overview tiles match the admin tiles, and the accent is the admin purple
  unless the agency set its own colour in Settings. Not checked in a browser, not deployed.
- Tab **ids and URLs did not change** (`content`, `channels`, `sales`, `brand`). Only the labels and
  the order follow admin: Calendar, Media, Integrations, Growth. So no redirects were needed and
  links in old WhatsApp/email messages still work.
- Access levels live in `portal-tabs.ts` (`off` / `view` / `act`). A tab with no client action
  (Overview, Analytics, WhatsApp, Growth, Ads, Reports) only offers Hidden / View only.
  Leads supports Can act (change status). Untouched clients keep what they could do before;
  old `true`/`false` rows still read.
- Server guard: `requirePortalTab(tabId, 'view' | 'act')` in `portal-guard.ts`, used by every
  `/api/portal/*` data route, `/api/approver/posts/[group]`, `/api/approver/channels`, and the
  channel connect flow (`current-organization-or-client.ts`).
- Agency page: Clients → **Portal control** (`/dashboard/social/clients/[id]/portal`): level per
  tab, up/down order (not drag — plan allowed), menu preview, Open as client, Copy to other clients
  (`POST .../portal-tabs/copy`), and this client's **WhatsApp reminders** (number + approval /
  payment / monthly report switches; uses the existing `agency-notify` API, no new sending code).
- ✅ **Save as default for new clients** (2026-11-18): `Organization.portalTabDefaults` Json +
  migration `20261118180000_org_portal_tab_defaults`. Portal control button copies that client's
  `portalTabs` via `POST .../portal-tabs/defaults`; org GET/PUT at
  `/api/social/clients/portal-tabs/defaults` (OWNER/ADMIN). `createClient` + bulk-assign new
  clients copy the org default into `SocialCustomer.portalTabs`. Existing clients unchanged.

## 6. Decisions needed (my pick first)

1. **What can a client do?** → *Three levels per tab (Hidden / View / Can act), default View.*
   Other option: everything exactly like admin (client can publish posts, edit ads). Risky: a client
   could publish or spend money by mistake.
2. **Inbox replies by client** → *Allowed only when admin sets Inbox to "Can act".*
3. **Agent tab** → *Off by default*, because each chat costs AI credits.
4. **Billing tab** → *Skip for now.*
5. **Order of work** → *Phase 1 and 2 first* (look + control), then missing tabs.

## 7. Rules (unchanged)

Client and organization only from `getPortalSession()`. Every query filters by both. Small portal
response shapes. Isolation test per tab. Works on phone. No deploy, no prod data, no Meta/Google/
WhatsApp writes without an explicit yes.
