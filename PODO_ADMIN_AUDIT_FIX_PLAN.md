# Podo Social — fix plan for the 24 Nov 2026 admin audit

Source: "Podo Social admin audit — 24 Nov 2026" (30 issues, PS-01 … PS-30, read-only audit of
`https://social.podospheretechnologies.com` under the admin login).

Every issue below was traced to code on 24 Nov 2026. Line numbers are from the current tree and will
drift once work starts. Nothing has been changed yet. This is only the plan.

**Two kinds of fix:**
- **Code**: a change in this repo, shipped with the normal deploy.
- **Data**: a change to rows on the production database or in Meta. Each one needs your explicit
  "yes" before it runs ([no-changes-without-permission] rule). These are listed separately in section 3.

---

## 0. The short version

The audit's numbers are wrong mainly for four reasons. Fixing these clears about half the list.

1. **Connecting a channel ignores the client you picked.** `getCurrentOrganizationOrClient()` always
   returns `customerId: undefined` for agency users (`src/shared/server/current-organization-or-client.ts:11`).
   On top of that, Meta's connect imports *every* Page the login manages (`meta.provider.base.ts:113-118`).
   So 114 channels arrived with no client. (PS-01, 03, 24)
2. **"All clients" means "everything in the workspace"**, including unassigned rows.
   `scopeWhere()` returns only `{organizationId}` (`src/shared/server/client-scope.ts:115-118`).
   (PS-03, 14, 24)
3. **Each page has its own definition of the same metric.** For example, clients count with or without
   deleted rows, 30 days as rolling UTC or Meta's `last_30d`, leads over all time or 30 days, and
   "waiting" as `take: 500` rather than a count. (PS-02, 08, 09, 10, 14)
4. **Heavy work runs inside page requests on a single web process.** That includes 89 Google Sheets
   synced inside a GET, 8 live Meta Graph calls with no cache, and the sidebar prefetching 16 dynamic
   routes. Everything else waits behind them. (PS-05, 06, 17, 18, 27)

One extra bug found while tracing, not in the audit:

- **PS-31 (Critical, security): webhooks from Pages that aren't connected are filed under the oldest
  workspace.** `ownerForPage()` (`src/modules/social/server/inbox/inbox.service.ts:113-125`) falls back
  to `organization.findFirst({ orderBy: createdAt asc })`. Any DM, comment or lead from a Page with no
  matching channel lands as an unassigned row in that workspace. This is a cross-tenant data leak, and
  it is one source of the inflated "All clients" inbox number.

---

## 0.0 Status (24 Nov 2026, code only — nothing committed, nothing deployed, no migration applied)

Build: `tsc` clean, 276 vitest tests pass, eslint clean. Three new migrations wait to be applied:
`20261124120000_org_tz_inbox_last_direction`, `20261124120000_phase1_client_attribution`,
`20261124130000_phase4_data_quality`.

- **Done in code:** PS-31, 02, 07, 08, 09, 10, 14 (count, `lastDirection` written on every message,
  paging, SLA only for real comments), 16, 17, 18, 20, 21, 22, 23, 25 (API), 26, 27, 28, 29, 30,
  11, 13, 15, 19, 01 (connect uses switcher client, Unassigned when none (R5), Meta Page picker),
  03 (Unassigned scope + switcher entry, Overview totals exclude Unassigned, separate "Map Pages"
  line), 04 (ad accounts keep their client, agency flag, confirm on move), 24 (client tag on upload +
  badge), 12 (desk rows auto-linked to Social clients + picker), R6 cascade + audit log on
  map/move/unmap.
- **Partly / not done:** PS-05/06 (Plugs from DB + worker; Meta Ads cached 15 min, only the daily
  series from DB), Map Pages screen still the existing Sort-channels page (no per-row dropdown or
  "Not a client: disconnect"), "Pick Pages" step on create-client, per-client breakdown table,
  approver edit UI (PS-25 is API-only), media backfill D5, inbox name backfill job not enqueued,
  R7 portal-session tests for unassigned rows, re-audit.
- **Data fixes D1–D7:** not run; each still needs an explicit yes.

## 0.1 Rule: every Page is mapped to a client (decided 24 Nov 2026)

This rule is fixed, and phase 1 builds it. Anyone coding from this file must follow it.

**R1. One Page, one client.** Every channel (`SocialIntegration`: FB Page, IG account, LinkedIn,
WhatsApp number) belongs to exactly one client (`customerId`), or it is **Unassigned**
(`customerId = null`). There is no "shared" state.

**R2. Unassigned Pages are admin-only.**
- Only OWNER and ADMIN can see an unassigned Page and its data (posts, inbox threads, leads, media,
  insights).
- MEMBERs, client approvers and the client portal never see them, not even as a count.
- Today MEMBER and portal scopes are already pinned to client ids (`scopeFromAccess`,
  `src/shared/server/client-scope.ts:33-59`). Keep it that way, and add tests that prove it (R7).

**R3. Unassigned is never part of a client's numbers.**
- Under "All clients", client totals use `customerId: { not: null }`.
- Unassigned shows separately, as an admin-only line or card: "114 Pages not mapped · 1,52,632
  followers", with a "Map Pages" button.
- Unassigned data never appears in a client's report, portal, AI plan, autopost or approval flow.

**R4. Where mapping happens:**
1. **When a client exists and is selected in the switcher**, connecting a Page maps it to that client
   automatically (phase 1, step 1).
2. **Creating a client:** the form has a "Pick this client's Pages" step that lists unassigned Pages.
3. **Client detail page:** "Add Pages" / "Remove Page".
4. **Map Pages screen (admin only):** the existing Clients → Sort channels screen. It lists every
   unassigned Page with:
   - a client dropdown per row and bulk assign;
   - the name-match suggestions (`suggestAssignments`, `customer.service.ts:295-340`);
   - a "Not a client: disconnect" action.
   A banner on Overview and Integrations links here while any Page is unmapped.

**R5. No client yet means the Page stays Unassigned.** If "All clients" is selected, or the client
hasn't been created yet, the Page is saved as Unassigned. It stays admin-only until someone maps it.
The connect flow doesn't block on picking a client.

**R6. Mapping, moving and unmapping:**
- **Map:** in one transaction, set `customerId` on the channel and backfill its rows that are still null
  (`SocialPost`, `SocialExternalPost`, `SocialInboxThread`, `SocialLead`, media used by its posts).
- **Move from client A to B:** needs a confirm ("12 posts, 40 threads and 3 leads move to B"), then
  moves the rows that came from that channel.
- **Unmap:** the Page goes back to Unassigned, and its rows go back to `null`, so admin-only again.
- Log every map, move and unmap (who, when, from, to) so a wrong mapping can be traced.

**R7. Acceptance tests** (add to the existing isolation tests in `src/shared/server/*.test.ts` and
`portal-inbox-isolation.test.ts`):
- A MEMBER of client A gets 0 rows from an unassigned channel on every list API (channels, posts,
  analytics, inbox, leads, media, overview).
- A portal session for client A gets 0 rows from an unassigned channel.
- OWNER/ADMIN under "All clients": the Overview client totals equal the sum of the per-client totals,
  and the Unassigned line equals the rest.
- Map → rows backfilled; unmap → rows back to null; move → rows on the new client.

---

## 1. Build order

Six phases, about 11–14 dev days. Phase 0 can ship on its own the same day. Phases 1–3 are the real
fixes. Phases 4–5 are quality and cleanup.

### Phase 0 — Quick wins (≈1 day, low risk, no schema change)

| ID | Fix | Where |
|---|---|---|
| PS-31 | Drop the fallback: return `null` for Pages that aren't connected, and log and ignore the event | `inbox.service.ts:119-124` |
| PS-02 | Add `deletedAt: null` to the clients count (14 → 5). Do the same in the layout's client list | `overview.service.ts:31-34`; `src/app/(dashboard)/dashboard/social/layout.tsx:22-29` |
| PS-07 | Fill `amountSpent` from a 30-day `adInsightDaily.groupBy` sum, instead of the hard-coded `0` | `ads.service.ts:740` (`listAccounts`) |
| PS-14a | Replace `findMany({take:500})` plus a JS filter with a real count (interim: count threads whose latest message is inbound, using a raw SQL `COUNT`) | `overview.service.ts:88-101`; same pattern in `portal-overview.service.ts:79-97` |
| PS-16 | Count only clients that have, or should have, a store in the denominator. Interim: "2 stores linked" with no ratio | `growth-desk.tsx:81-86` |
| PS-17a | Add `prefetch={false}` to the rail and header Links | `icon-rail.tsx:87,98`, `social-shell.tsx:92-101` |
| PS-20a | Render "Upcoming occasions" once: remove it from `ai-studio.tsx:565-568` | `ai-studio.tsx` |
| PS-22 | SWR key `scopeKey !== 'all' ? [...] : null` in the three order-flow hooks, plus a "Pick a client" empty state | `hooks/use-order-flows.ts:27,42,55`; `order-flows-desk.tsx` |
| PS-27a | Render nothing until data arrives, instead of flashing "Not linked" | `podocrm-whatsapp-link-card.tsx:117` |
| PS-28 | Remove the bottom "Billing" (the main list already has `/billing`). Hide "Affiliate", which has no page | `icon-rail.tsx:18-37` |
| PS-29 | Show the source next to the plan: "Agency Pro · set manually, no active subscription" when there is no active `socialSubscription` | `billing-panel.tsx:150`, `billing.service.ts:373-399` |
| PS-10a | Exclude stories from "Posts Published": `type: { not: 'story' }` in `listExternalPosts`. Add `parentPostId: null` to the report counts | `analytics.repository.ts:62-88`; `report.service.ts:268-271, 352-358` |

**Check before shipping phase 0:** sample the rows behind PS-10 (see 4.2). If the reply texts
("entry received", "All the best 🧡") are in `SocialExternalPost`, the story filter is not enough.
Phase 2 handles that case.

### Phase 1 — Client attribution (≈3 days, Critical: PS-01, 03, 04, 24, 12)

The goal: every row has a client or is visibly "Unassigned", and "All clients" totals equal the sum of
the clients plus Unassigned. Follow rules R1–R7 in section 0.1.

1. **Connect uses the selected client (PS-01).**
   `src/app/api/social/integrations/connect/[provider]/route.ts:17`: pass
   `customerId ?? (await resolveSelectedClientId())` to `getConnectUrl`, as the Meta Ads connect already
   does (`ads/accounts/connect/route.ts:15`). If "All clients" is selected or no client exists yet, save
   the Pages as Unassigned (R5) and show "N new Pages not mapped · Map Pages" after connect. Don't block
   the connect.
2. **Page picker after Meta OAuth (PS-01).** Save only the Pages and IG accounts that were ticked, not
   all `me/accounts` (`meta.provider.base.ts:113-118`). This stops 60+ unrelated Pages being imported on
   every reconnect.
3. **Cascade on assign (PS-01, 24).** `assignIntegrations` / `bulkAssign`
   (`customer.service.ts:51-86, 343-410`) update only the channel today. In the same transaction,
   backfill `customerId` on that channel's `SocialPost`, `SocialInboxThread`, `SocialLead` and
   `SocialExternalPost` rows that are still `null`.
4. **"Unassigned" bucket (PS-03, R2–R4).** Add a scope value `'unassigned'` → `customerId: null` in
   `client-scope.ts`, plus an "Unassigned" entry in the switcher (OWNER/ADMIN only).
   - `scopeFromAccess` must throw 404 if a MEMBER or a portal session asks for `'unassigned'`.
   - Build or extend the admin-only **Map Pages** screen (Clients → Sort channels) and the "Pick Pages"
     step on the create-client form (R4).
   - Add the R6 move/unmap flows with confirm and an audit log, and the R7 tests.
   - Overview under "All clients": client totals use `customerId: { not: null }`.
   - Show the unassigned figure as its own line ("+ 1,52,632 followers on 114 unassigned channels").
   - Also add a per-client breakdown table. This is D1 in `PODO_SOCIAL_EXISTING_FEATURES_PLAN.md`; build
     it here.
5. **Ad accounts keep their client (PS-04).** In `confirmConnectedAccounts` (`ads.service.ts:955-1022`,
   overwrite at :996), keep `existing.customerId` unless the request names a client explicitly.
   - Refuse to move an account that is already on another client unless `force: true`, and show a
     confirm in the UI.
   - Same guard in `assignMetaAdAccounts` (`customer.service.ts:88-123`).
   - Add an "Agency account (not a client)" flag on `AdAccount` so the agency's own account is never
     counted in client spend.
6. **Media belongs to a client (PS-24).** Under "All clients", the upload/AI/template flows must ask
   for a client (`media.service.ts:51-53`, `customerIdForWrite`). Show a client badge per item
   (`toMediaItem`, `media.repository.ts:70-88`). One-off backfill: set `customerId` from the posts that
   use each file (data step D5).
7. **Client Desk uses the same clients (PS-12).** Make `OpsClient.socialCustomerId` a real `@relation`
   to `SocialCustomer` with an org check (`prisma/schema/ops.prisma:8`). Client Desk then lists the 5
   social clients with retainer/collection fields beside them: auto-create an `OpsClient` per
   `SocialCustomer` on first open, and add a "Linked Social client" picker.

Schema: `AdAccount.isAgencyAccount Boolean @default(false)`, plus the `OpsClient` relation. Both are
additive.

### Phase 2 — One definition per metric, in IST (≈2 days: PS-08, 09, 10, 14, 21)

1. **`Organization.timeZone`** (default `"Asia/Kolkata"`, `prisma/schema/core.prisma`). Add a shared
   helper `src/shared/lib/metric-window.ts`:
   - `last30Days(tz)` returns `{ from: today-30, to: today-1 }` as dates in the org's timezone. That
     means complete days, the same as Meta's `last_30d`.
   - Use it in the Overview (`overview.service.ts:13-15, 53-58`), Reports (`report.service.ts:58-62, 266`)
     and portal overview (`portal-overview.service.ts:62-72`).
2. **Ad spend matches the Ads page (PS-08).** With the helper, the Overview sums `AdInsightDaily` for the
   same 30 complete days the Ads page asks Meta for. Also stop defaulting new OAuth ad accounts to
   `timezoneName: 'UTC'` (`ads.service.ts:1010`); read it from Meta at connect.
3. **Leads label (PS-09).** Overview leads get a 30-day window (the count is all-time today,
   `overview.service.ts:29`) and the label "Leads captured (30d)". Show Meta-reported leads beside it as
   "Meta reports 66". They differ on purpose: Meta also counts pixel/website leads.
4. **Published = posts only (PS-10).** One allow-list `PUBLISHED_POST_TYPES = ['post','reel','video','carousel']`
   used by Analytics and Reports. If 4.2 shows replies in `SocialExternalPost`, also filter by
   `parent_id`/comment type at sync (`analytics.worker.ts:265-297, 564-593`).
5. **Inbox waiting is a real count (PS-14).**
   - Add `SocialInboxThread.lastDirection` (set on every message write) and make "waiting" a
     `count({ lastDirection: 'inbound', status: open })`.
   - Paginate the inbox list (`inbox.service.ts:383-399`, `take: 100`).
   - SLA only for DMs and comments that need a reply. Skip emoji-only or very short comments and
     story mentions (`slaDueFromNow`, `inbox.service.ts:36-38`).
6. **Calendar timezone (PS-21).** Extend dayjs with `utc` + `timezone` in `lib/calendar.ts` and render
   `dayjs().tz(orgTz).format('[GMT]Z')` (`time-grid-view.tsx:38,64`). Also set `TZ=Asia/Kolkata` in
   `ecosystem.config.cjs` as a safety net for server-rendered dates.

Schema: `Organization.timeZone`, `SocialInboxThread.lastDirection` (+ a one-off backfill from the
latest message). Both are additive.

### Phase 3 — Speed (≈2–3 days: PS-05, 06, 17, 18, 27)

1. **Plugs page (PS-05).** Move the sheet sync into the worker.
   - Add a `googleSheets.syncAll` job scheduler (every 15 min) in `src/worker/index.ts`, using the
     pattern in `growth.worker.ts:100-103`.
   - `GET /api/social/google-sheets` reads only from the DB. `?autoSync=1` at most enqueues a job behind a
     Redis lock (`google-sheets.service.ts:623-639`). The UI shows "Last synced 12 min ago · Sync now".
   - Also turn off SWR `revalidateOnFocus` for that hook (`use-automation.ts:21-25`). Each tab focus can
     start another 89-sheet sync today, and nothing prevents two syncs running at once.
   - The post composer's `contentForDate` (`google-sheets.service.ts:668`) must also stop syncing inline.
2. **Meta Ads page (PS-06).** Build the account overview from `AdEntity` / `AdInsightDaily`, which the
   ads worker already fills hourly (`ads.worker.ts:459-466`). Fall back to live Graph only for fields not
   stored, wrapped in Redis `SET EX 900` (`src/shared/lib/redis.ts`). Also remove the duplicate
   `listAccounts` call in `requireAccount` / `requireAccountToken` (`ads.service.ts:759`).
   Target: under 2 s.
3. **Page load (PS-17b).** Add `loading.tsx` skeletons under `src/app/(dashboard)/dashboard/social/`.
   There are none today, so every navigation blocks on the layout's three DB queries. Cache the
   layout's client list per request.
4. **Client switch (PS-18).** In `client-scope-provider.tsx:35-47`:
   - Set the new scope optimistically and show a "Switching to Siyara…" bar with dimmed cards (expose
     `isSwitching`).
   - Revalidate only the keys of the new scope, not every `/api/social` key.
   - Drop `router.refresh()`.
   - Remove `keepPreviousData: true` where it shows the old client's numbers under the new client's name
     (`use-ads.ts:112,147`, `use-analytics.ts:17`, `use-posts.ts:15,29`, `use-media-library.ts:20`,
     `use-google-ads.ts:27`, `use-best-times.ts:15`).
5. **PodoCRM ping (PS-27b).** `lastPingAt` is written once, at link time
   (`podocrm-whatsapp-sync.service.ts:259-260`). Add a daily ping job in the worker. Show "Last ping
   7 weeks ago" as a warning when it is older than 24 h.

Verify with the audit's own method: Network tab, then KPI cards filled in under 2 s, Plugs renders
immediately, and Meta Ads renders in under 2 s on a second visit.

### Phase 4 — Data quality (≈2–3 days: PS-11, 13, 15, 19, 25, 26)

| ID | Fix | Where |
|---|---|---|
| PS-11 | FB post insights come back null because one request asks for metrics that are deprecated on Graph v26 (unverified against Meta's docs). One bad metric fails the whole call, and the error is swallowed. Request current metrics (`post_media_view`, `post_total_media_view_unique`, `post_clicks_by_type`), each with its own try, and log failures. Add `engagement` and `clicks` columns to `SocialExternalPost` and write them. Hide columns that are empty for a whole table | `post-metrics.ts:99-121, 152-179`; `analytics.worker.ts:340-351, 468-480`; `analytics.service.ts:277-279`; `social.prisma:963-986` |
| PS-13 | Resolve names: on thread create, call `GET /{psid}?fields=name` (Messenger) or `username` (IG) with the page token, and store the result. Comments: use `from.name ?? from.username`. Skip `is_echo` events. One-off backfill job for existing threads | `inbox.service.ts:888-910, 1069-1075` |
| PS-15 | Growth summary returns `lastError` and `lastSyncedAt`. Show "Sales as of 18 Nov · sync failing: <reason>", and a "No ad account linked" pill when `!hasAds` | `growth.service.ts:425-428, 478-481`; `growth-desk.tsx:109-113` |
| PS-16b | Real client type: `SocialCustomer.clientType` ('store' / 'website' / 'leads'), set on the client form. It drives the store ratio and ROAS-vs-CPL mode, and replaces the guess at `growth-desk.tsx:167` | `social.prisma:93-122` |
| PS-19 | Under "All clients", report the keys that exist: "No server key · 2 clients have their own Gemini key". `/api/social/ai` returns per-client status, not one boolean | `ai-settings.service.ts:45-49, 114-133`; `ai.service.ts:303-311`; `ai-provider-settings.tsx:219` |
| PS-25 | Make approver email and name editable (`updatePortalApproverSchema` accepts only `disabled`/`phone` today). Move `onboardingStep` forward automatically when channels are linked, a magic link is made or a brand kit is saved | `api/social/clients/[id]/approvers/[approverId]/route.ts:17-24`; `customer.service.ts:230-250`; `client-template.service.ts:329-337` |
| PS-26 | Clean names on save (trim, strip unbalanced quotes and control characters) in `integrationRepository.upsert`. Mark `refreshNeeded` only for real token-expiry subcodes (460/463/467), not every code 190, and log the subcode | `integration.service.ts:200`; `integration.repository.ts:93-106`; `graph-client.ts:39-41` |

### Phase 5 — Cleanup (≈1 day: PS-20, 23, 30, re-audit)

- **PS-20b:** add the India dates to `config/festival-calendar.ts`: Guru Nanak Jayanti, Lohri, Makar
  Sankranti/Pongal, Republic Day, Holi, Navratri/Dussehra, Raksha Bandhan, Ganesh Chaturthi, Onam,
  Independence Day. Better still, add a yearly table so it doesn't run dry after Diwali.
- **PS-23:** fetch `display_phone_number` and `verified_name` in `completeSignup`
  (`whatsapp-growth.service.ts:174,182`). Show "Number not loaded" instead of the raw
  `phoneNumberId`, and stop printing the raw WABA id in the header (`whatsapp-growth-tools.tsx:491,518`).
- **PS-30:** Reports POST accepts `{ customerId?, month: 'YYYY-MM' }`, which the worker already supports
  (`report.service.ts:313-321`). GET takes the same filters. Add a client and month picker plus an empty
  state to `reports-panel.tsx`.
- **Re-audit:** repeat the audit's reference table with the same 5 clients. Expected: Clients = 5;
  All-clients followers, posts and inbox = sum of clients + Unassigned line; Overview spend = Ads page
  spend; no page over 2 s.

---

## 2. Issue index

| ID | Sev | Phase | Kind | One-line root cause |
|---|---|---|---|---|
| PS-01 | Critical | 1 + D1 | Code + Data | Connect ignores the selected client; Meta imports every Page |
| PS-02 | Critical | 0 | Code | Clients count includes soft-deleted rows |
| PS-03 | Critical | 1 | Code | "All clients" = whole workspace, no Unassigned bucket |
| PS-04 | Critical | 1 + D2 | Code + Data | Ad-account confirm overwrites `customerId` with the switcher client |
| PS-05 | Critical | 3 | Code | 89-sheet sync runs inside the GET request |
| PS-06 | High | 3 | Code | 8 live Graph calls, no cache, while the DB already has the data |
| PS-07 | High | 0 | Code | `amountSpent: 0` hard-coded |
| PS-08 | Medium | 2 | Code | Rolling UTC 30d incl. today vs Meta's 30 complete days |
| PS-09 | Medium | 2 | Code | Leads card is all-time and webhook-only; Meta also counts pixel leads |
| PS-10 | High | 0 + 2 | Code | No type filter; stories (and possibly replies) counted as posts |
| PS-11 | High | 4 | Code | Deprecated FB metrics fail the whole insights call silently; engagement/clicks never stored |
| PS-12 | High | 1 | Code | `OpsClient` is a separate table, link field unused |
| PS-13 | High | 4 | Code | Sender PSID stored as the contact name; never resolved |
| PS-14 | High | 0 + 2 | Code | `take: 500` / `take: 100` read as counts; SLA on every comment |
| PS-15 | Medium | 4 | Code | `lastError` / `lastSyncedAt` stored but not returned |
| PS-16 | Low | 0 + 4 | Code | Denominator is all clients; no client type exists |
| PS-17 | High | 0 + 3 | Code | Rail prefetches 16 dynamic routes; no `loading.tsx` |
| PS-18 | High | 3 | Code | Switch awaits PUT, then refetches everything, keeps old data |
| PS-19 | Medium | 4 | Code | All-clients scope ignores client-level keys |
| PS-20 | Low | 0 + 5 | Code | Component mounted twice; static list of 9 occasions |
| PS-21 | Medium | 2 | Code | `dayjs()` local time; no org timezone |
| PS-22 | Low | 0 | Code | Hook fetches under 'all' (truthy key) |
| PS-23 | Low | 5 | Code | `displayPhone` never fetched |
| PS-24 | Medium | 1 + D5 | Code + Data | Media `customerId` null unless one client selected |
| PS-25 | Medium | 4 + D3 | Code + Data | Approver email not editable; onboarding step only moves by hand |
| PS-26 | Medium | 4 + D4 | Code + Data | Any code-190 flags reconnect; names saved verbatim |
| PS-27 | Medium | 0 + 3 | Code | Ternary renders "Not linked" while loading; ping written once |
| PS-28 | Low | 0 | Code | Bottom nav entries all point to `/settings` |
| PS-29 | Low | 0 | Code | Plan set manually by script; label hides that |
| PS-30 | Low | 5 | Code | API has no client/month input; UI has no picker or empty state |
| PS-31 | Critical | 0 | Code | Webhooks from unknown Pages filed under the oldest workspace |

---

## 3. Data fixes on production (each needs your explicit yes)

Run these only after the phase that makes them stick, or the problem comes back.

| # | What | After | How |
|---|---|---|---|
| D1 | Sort the 114 unassigned channels: assign the client ones, then disconnect (soft-delete) Pages that aren't clients | Phase 1 (cascade on assign) | Clients → Sort channels screen. List the Pages first and confirm each group with you |
| D2 | Set `act_623028240126874` (Podosphere Technologies Pvt Ltd) to `customerId = null`, `isAgencyAccount = true`. Connect Francoleone's own ad account (Francoleone must grant access in their Business Manager) | Phase 1 | one `UPDATE`, run as a reviewed script |
| D3 | Replace placeholder approvers: Miphoria (`sarthak@gmail.com`), Invesbricks (`info@podospheretechnologies.com`), and Siyara's "Vikash" | Phase 4 (editable approvers) | real emails from you |
| D4 | Reconnect or remove the 8 flagged channels: seere.india, avira_essentials, jaipursolarsolutions, ehsaasbyyash, Seere, JAIPUR SOLAR SOLUTIONS, Sovam Crop Science, Starbeam Events | Phase 4 (fewer false reconnect flags) | Integrations page; you decide which are still clients |
| D5 | Backfill `customerId` on existing media, posts, threads and leads | Phase 1 | one-off script, dry run first, then `--apply` |
| D6 | Delete rows filed under the wrong workspace by PS-31 (threads/leads from Pages that aren't connected) | Phase 0 | dry-run report first |
| D7 | Workspace merge (Surbhi's vs admin@) still pending from 10 Nov: see `PODO_SOCIAL_EXISTING_FEATURES_PLAN.md` §10 | any time | `scripts/move-user-to-workspace.ts`, dry run by default |

---

## 4. Open questions and checks before starting

1. **Which of the 114 unassigned Pages are clients?** The Meta login manages Pages for past clients and
   prospects too. Decided 24 Nov: you map them yourself on the Map Pages screen (R4). Pages for clients
   not created yet stay Unassigned and admin-only (R5). D1 is then only "disconnect the ones that will
   never be clients", and that still needs your yes.
2. **PS-10 sample.** Run a read-only query for the 30-day "published" rows whose text matches
   "entry received" / "All the best". It shows which table they live in, and therefore whether phase 0
   alone fixes it.
3. **PS-11 metric names.** Check the current Graph v26 Page-post insight metrics in Meta's changelog
   before coding (read-only).
4. **Agency's own account on Overview.** Under "All clients", should the agency's spend appear as its
   own line, or be hidden? This plan assumes its own line, "Agency (own ads)".

## 5. Not covered (the audit did not check these either)

Client portal under a client session, mobile width, Growth "Open desk" sub-pages, Analytics
"Audience & Competitors", Calendar month/list views, Settings sub-tabs, and any create/edit/delete
flow. Phases 1–2 touch the portal's overview, so re-check the portal numbers in the phase 5 re-audit.
