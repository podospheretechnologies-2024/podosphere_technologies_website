# Client Portal plan — each client sees only their own data

Written 2026-11-10. Status: **Phases 1–5 done (core portal).** Build with `/client-portal`.

## 1. What exists today

- `/portal` (Phase 2 shell) with sidebar + tab registry. Legacy `/approver/portal` redirects here.
  Live tabs: Overview, Content, Analytics, Ads, Leads, Sales, Reports, Channels, Requests.
- Login: **email + password** (Phase 1) on `/login` → Client login tab, plus **magic link** still works
  (`/api/social/clients/[id]/magic-link`). Cookie `approver_session` (`PortalSession` =
  `{ approverId, organizationId, customerId, mustChangePassword }`). Password sessions: 7 days
  (remember me 30). Magic link sessions: 12 hours.
- A client login = a `ClientApprover` row (email + name, per client; email unique per organization).
  Agency: Clients → **Portal access** (logins, tab toggles, goals/budget, request status).
- Data is already split per client: channels (`SocialIntegration.customerId`), Meta ad accounts
  (`AdAccount.customerId`), Google Ads (`SocialGoogleAdsAccount.customerId`), Growth Desk
  (`growth-scope.ts`), leads, reports.

## 2. What we want

A client logs in on **social.podospheretechnologies.com** with **email + password** and sees the
same kind of tabs the agency sees, but **only their own client's data**:

| Portal tab | Shows (this client only) | Source we already have |
|---|---|---|
| Overview | followers, reach, posts this month, ad spend, leads, sales — one screen | insights + ads + growth |
| Content | calendar of planned + published posts; approve / ask for changes | posts, approvals |
| Analytics | per channel: Instagram, Facebook, LinkedIn, YouTube… growth + best posts | `analytics.service` |
| Ads | Meta + Google Ads: spend, results, cost per result, running ads with previews | `ads.service`, `google-ads` |
| Leads | leads from ads / WhatsApp / forms, status | leads module |
| Sales | Shopify orders, revenue, ROAS (only if Shopify connected) | Growth Desk |
| Reports | monthly PDF reports to download | `report.service` |
| Channels | connected pages, reconnect button | existing tab |
| Requests (new) | client asks for a post / campaign / change, sees status | new, small |

Read-only by default. The only things a client can **do**: approve/reject posts, leave notes on
drafts, reconnect their own channels, send requests, change their own password.

## 3. Rules (security)

1. Every portal query filters by `session.customerId` **and** `session.organizationId`. Never take a
   client id from the URL or the request body.
2. One guard for all portal pages and APIs: `getPortalSession()` (exists). Portal APIs live under
   `/api/portal/*` (new) or `/api/approver/*` (existing).
3. Agency decides per client which tabs show (e.g. hide ad spend from one client). Stored on the client.
4. No tokens, ad account ids, internal notes, other clients' names, or cost/margin fields in portal
   responses. Return small portal-specific shapes, not the admin objects.
5. Each tab has an isolation test: data of client B never appears for client A (same pattern as
   `growth-isolation.test.ts`).

## 4. Phases

**Phase 1 — Password login (the base)** ✅ done 2026-11-10
- DB: `ClientApprover.passwordHash`, `mustChangePassword`, `lastLoginAt`, `disabledAt`; email unique
  per organization (`@@unique([organizationId, email])`). Migration:
  `prisma/migrations/20261110140000_client_approver_password`.
- Agency: Clients → **Portal access** modal — add login, **Generate password** (shown once),
  **Send set-password link**, disable/enable.
- Client: `/login` **Client login** tab; `/client/set-password` for emailed links; forced
  `/approver/change-password` when `mustChangePassword`. Cookie lifetimes: 7d / 30d remember me.
  Rate-limited via Redis. Same error text for wrong email or password. Magic link kept.
- Service: `src/modules/social/server/portal/portal-auth.service.ts` + isolation test
  `portal-auth-isolation.test.ts`.
- Left for later: dedicated `/api/social/clients/[id]/portal-login` if still missing; multi-login
  UX polish beyond the modal.

**Phase 2 — Portal shell + tab registry** ✅ done 2026-11-10
- `/portal` with agency-branded sidebar (mobile: top menu + bottom nav). `/approver/portal` redirects.
- `src/modules/social/config/portal-tabs.ts` registry:
  `{ id, label, icon, href, enabled(client) }`.
- Per-client toggles: `SocialCustomer.portalTabs` Json + agency UI in Portal access modal.
  API: `GET/PATCH /api/social/clients/[id]/portal-tabs`. Migration:
  `prisma/migrations/20261110180000_client_portal_tabs`.
- Defaults: Overview, Content, Analytics, Reports, Channels, Requests on; Ads / Sales / Leads when
  connected. Ad spend visible by default (`adSpendVisible`).
- Isolation: `portal-tabs-isolation.test.ts`.

**Phase 3 — Data tabs** ✅ done 2026-11-10
- Overview polish: spend / leads / sales / posts + this-month feed + goals (shared with Phase 5).
- Analytics: `portal-analytics.service.ts` + `/portal/analytics` (per-channel + best posts).
  Isolation: `portal-analytics-isolation.test.ts`.
- Ads: `portal-ads.service.ts` + `/portal/ads` (Meta from `AdInsightDaily`; Google live soft-fail;
  respects `adSpendVisible`). Isolation: `portal-ads-isolation.test.ts`.
- Content calendar: `portal-content.service.ts` + month calendar on `/portal/content` (planned /
  published / approval) alongside approve + notes.
- Reports: `portal-reports.service.ts` + `/portal/reports` (PDF list/download, this client only).
  Isolation: `portal-reports-isolation.test.ts`.

**Phase 4 — Leads, Sales (Shopify), Requests** ✅ done 2026-11-10
- Leads: `portal-leads.service.ts` + `/portal/leads` + `GET /api/portal/leads` (read-only; no payload /
  CRM / assignee). Isolation: `portal-leads-isolation.test.ts`.
- Sales: `portal-sales.service.ts` + `/portal/sales` + `GET /api/portal/sales` (Shopify daily metrics +
  ROAS when `adSpendVisible`). Isolation: `portal-sales-isolation.test.ts`.
- Requests: new `SocialPortalRequest` (`prisma/migrations/20261110190000_portal_requests`). Client
  create/list via `/api/portal/requests`; agency status updates in Portal access modal via
  `/api/social/clients/[id]/portal-requests`. Isolation: `portal-requests-isolation.test.ts`.

**Phase 5 — Nice to have (slice)** ✅ done 2026-11-10
Built:
1. **What we did this month** — Overview feed (posts, campaigns live, leads, orders, requests, spend).
2. **Comment on a post** — Leave note / approve with note / request edit (required note). Stored in
   `SocialPost.settings.clientNotes`. Isolation: `portal-notes-isolation.test.ts`.
3. **Goals** — agency sets leads/posts targets; Overview progress bars.
4. **Budget view** — planned `adBudgetPerMonth` vs spend this month (respects `adSpendVisible`).
   DB: `SocialCustomer.portalGoals` (`prisma/migrations/20261110200000_portal_goals`).
   API: `GET/PATCH /api/social/clients/[id]/portal-goals`. Isolation: `portal-goals-isolation.test.ts`
   + `portal-overview-isolation.test.ts`.

Leftover ideas progress (2026-11-10):
- ✅ WhatsApp/email approval alerts — email all enabled portal logins when a post hits CLIENT;
  optional `ClientApprover.phone` for WhatsApp soft-send (`portal-approval-alert.service.ts`).
- ✅ Brand kit upload — `/portal/brand` tab (edit kit + upload images into that client's media).
- ✅ Monthly report autopilot — already cron'd (`REPORT_JOB.scheduleMonthly`) + portal Reports tab.
- Still later: ad creative approval, deeper multi-login UX, deeper mobile polish.

## 5. Ideas

1. **Monthly report on autopilot** — ✅ cron + portal Reports downloads.
2. **"What we did this month"** — ✅ Overview feed.
3. **Brand kit upload** — ✅ `/portal/brand` (kit fields + image uploads to client media).
4. **Ad creative approval** — the same approve/reject flow for ads before they go live. (still open)
5. **Comment on a post** — ✅ client notes on drafts.
6. **Goals** — ✅ agency targets + progress bars.
7. **WhatsApp alert** — ✅ email always; WhatsApp when phone saved on the portal login.
8. **Budget view** — ✅ planned vs spent ad budget this month.
9. **Mobile-first** — shell has mobile nav; keep checking each new tab at phone width.
10. **Several logins per client** — Phase 1 already allows multiple `ClientApprover` rows; polish later.

## 6. Decisions (locked 2026-11-10)

- First password: **both** — agency generates (shown once) **and** send set-password link.
- Login page: **Client login tab on `/login`** (not a separate page).
- Default tabs (Phase 2): Overview, Content, Analytics, Reports; Ads / Sales / Leads when connected.
- Ad spend: **on by default**, switchable per client (Phase 2).
