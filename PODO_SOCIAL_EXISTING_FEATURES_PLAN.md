# Podo Social — Existing features first (1 Nov 2026)

Decision taken 1 Nov 2026: improve what already exists before building the autopilot loop in
`PODO_SOCIAL_AUTOPILOT_PLAN.md`. This document is the audit and the build order for that.

It covers the three things asked for: how a client's data is shown client by client, how each kind of
user reaches the product (website → login → dashboard or portal), and everything found along the way.
Every statement below was checked against the code on 1 Nov 2026. Section 0 is the only thing already
done; everything else is a plan.

---

## 0. Done today (1 Nov 2026)

| Change | Where | Effect |
|---|---|---|
| Gemini key added for testing | local `.env` → `GEMINI_API_KEY` (not committed; `.env` is git-ignored) | Verified against Google's API: model list and one `gemini-flash-latest` generation both returned 200. Rotate the key after testing. |
| Env fallback chain Claude → OpenAI → Gemini | `src/modules/social/server/ai/ai-settings.service.ts` → `envTextConfig()` | With `ANTHROPIC_API_KEY` empty, every client without its own key now runs on the env Gemini key: Content Studio (posts, posts from a link, threads), AI images (Gemini image model) and the "effective provider" line on the Agent page. Lint clean, 95/95 unit tests pass. |

Still **Claude-only** after this change (they call `askClaude()` / `isClaudeConfigured()` in
`claude.client.ts`, which only reads `ANTHROPIC_API_KEY`): weekly plan, copilot agent, inbox triage
and reply drafts, ads creative helper, competitor AI summary, audience AI summary, media vision alt
text, monthly report narrative. They keep saying "Set ANTHROPIC_API_KEY" until phase 0 below.

Production still needs `GEMINI_API_KEY` in its `.env` and a `pm2 reload` (only you can do that).

---

## 1. Who gets in, and how (verified)

| Who | Entry | Auth | Session | Sees |
|---|---|---|---|---|
| Agency OWNER | `/` → `/register` creates the organization + OWNER | email + password (`auth.service.ts`) | 7-day JWT cookie `podo_session`, no revocation | whole dashboard, all clients |
| Agency ADMIN / MEMBER | `/invite?token=` from the Team page | one-time 72 h invite link, sets own password | same | ADMIN = everything; MEMBER = only clients they are a `SocialClientMember` of |
| Client approver | `/api/approver/verify?token=` → `/approver/portal` | one-time 72 h magic link, exchanged for a 12 h portal session | `approver_session` cookie, revocable by `tokenVersion` | one client: overview stats, posts waiting for approval, connected channels, connect buttons |
| Platform admin | `/admin/login` → `/admin` | password + `isPlatformAdmin` | same as agency, plus `podo_impersonate` cookie | all agencies, sync board, impersonate owner |

Public pages: `/` (marketing), `/privacy`, `/terms`, `/data-deletion`, `/support`, `/docs/api`,
`/b/[slug]` bio pages, `/l/[code]` short links.

### Gaps in the login / access path

| # | Gap | Evidence | Why it matters |
|---|---|---|---|
| L1 | No password reset | no `forgot` / `reset` code anywhere in `src` | A forgotten password means a database edit by you |
| L2 | Invite link is shown once and copied by hand | `team-client.tsx` shows `inviteUrl`; nothing emails it | You are the postman for every new staff login |
| L3 | Magic link is copied by hand and never sent | `clients/page.tsx` → `generateLink()` copies to clipboard; the portal's expired state says "use the magic link from your email", but no email or WhatsApp is ever sent; no "send me a new link" for the client | The client cannot get in without you; every 72 h you repeat it |
| L4 | **MEMBER users can never see a client** | nothing in `src` creates `SocialClientMember` rows (no API, no UI); `Invitation.clientAccess` is saved as `[]` and ignored in `acceptInvitation()` | Every invited MEMBER lands on "No client assigned" and empty pages. Only ADMIN is a usable role today |
| L5 | No session revocation for staff | `User` has no `tokenVersion`; logout only deletes the cookie | Removing a person does not end their 7-day session (deleted users do fail `getCurrentUser`, but role/permission changes do not apply until re-login) |
| L6 | No email verification on register | `authService.register()` | Fine for pilots; decide before public sign-up |
| L7 | White-label has no UI | `Organization.logoUrl / primaryColor / portalTitle / customDomain` exist and the portal reads them; the custom-domain route has **no caller** in the UI | Agencies cannot brand the portal without a database edit |
| L8 | Dashboard is desktop-only | `social-shell.tsx`, `icon-rail.tsx`, `channels-panel.tsx` have zero responsive breakpoints | Anyone opening the dashboard from a phone gets a broken layout. The portal is partly responsive |

---

## 2. Client-wise data: what works, what is missing

What works (keep): `ClientScope` + `scopeWhere()` on every data list, switcher cookie `podo_client`,
MEMBERs pinned to one client, OWNER/ADMIN "All clients", brand kit / AI provider / AI budget / API keys
/ reports / tags / signatures per client, portal per client, tenant-isolation tests in
`src/shared/server/*.test.ts`.

| # | Gap | Evidence | What the user feels |
|---|---|---|---|
| D1 | "All clients" has no per-client breakdown | `overview.service.ts` returns 8 totals; `agency-overview.tsx` renders 8 cards | You cannot see which client needs attention without switching one by one |
| D2 | Rows do not say which client they belong to | `customerName` only appears in API keys, billing, UTM link components; calendar chips, inbox threads, leads, media, posts show none | In All-clients mode a draft or a DM could be anyone's |
| D3 | No client detail page | Clients page = create form + link form + copy link + onboarding checklist | No single place for one client's channels, approvers, members, brand kit, AI usage, reports, portal activity |
| D4 | Approvers cannot be managed | one approver is created with the client; `clients/[id]/route.ts` only relinks assets; `ClientApprover` has no phone | Wrong email = database edit; no WhatsApp delivery possible |
| D5 | Unassigned channels are invisible | rows with `customerId = null` only show in All mode (`scopeWhere`); channels panel says "Pick a client"; nothing nudges you to link them | New connections "disappear" until linked on the Clients page |
| D6 | No freshness indicator | `SocialSyncState` is only used for the "Sync errors" count; no "last synced x min ago" per channel or client | You and the client cannot tell if numbers are current |
| D7 | Everything is UTC | weekly plan anchors Monday 09:00 UTC (`weekly-plan.service.ts:42-50`); `SocialCustomer` has no time zone; the portal formats dates with `toLocaleDateString()` on the server (server zone) | 09:00 UTC = 14:30 IST; evening posts show the wrong day on the portal |
| D8 | Deleted clients still listed | `social/layout.tsx`, `client-scope/route.ts`, `overview.service.ts` query `socialCustomer` without `deletedAt: null`; `customerService.listCustomers` does filter | Harmless today only because there is no delete action |
| D9 | No pause / archive for a client | no status field, no delete route | A churned client keeps syncing and counting against plan limits |

---

## 3. What the client sees (portal) — gaps

| # | Gap | Evidence |
|---|---|---|
| P1 | Overview is 4 totals + 6 recent posts; no date range, no per-channel split, no trend | `approver/portal/page.tsx` |
| P2 | Approval cards: text only (no media preview), approve / reject through `window.prompt`, no bulk approve, no scheduled time in the client's zone, no "why this post" | `portal-approval-actions.tsx` |
| P3 | Nothing else to see: no upcoming-posts calendar, no reports list (monthly PDFs are emailed only, and email is off), no inbox or leads summary | portal has three tabs |
| P4 | Branding is header colour + logo; no favicon, no page title, no footer | `branded-portal-shell.tsx` |
| P5 | Expired session is a dead end ("use the magic link from your email") | portal `!session` branch |

---

## 4. Bugs to fix regardless of the plan

| # | Bug | Where | Fix |
|---|---|---|---|
| B1 | Unmatched Meta webhooks land in the **oldest** organization (cross-tenant) | `inbox.service.ts` → `ownerForPage()` | return `null` and drop the event with a log line; then run the probe cleanup SQL in `data/go-live/README.md` on prod |
| B2 | Claude-only paths ignore the per-client provider | `weekly-plan.service.ts`, `agent-runner.ts`, `inbox.service.ts` (triage), `creative-helper.service.ts`, competitor + audience routes, `media-vision.service.ts`, `report.service.ts` | route all structured calls through `askAI()`; keep only the copilot agent on the Anthropic SDK (it needs tool use) and make its "not configured" message say so |
| B3 | UI copy says "Set ANTHROPIC_API_KEY in .env and restart" | `content-studio.tsx`, `ai-studio.tsx`, `ai-image-generator.tsx`, `autopost-dialog.tsx` | one shared message: "AI is off. An admin can set a provider on the Agent page." |
| B4 | Switcher and overview count soft-deleted clients | see D8 | add `deletedAt: null` in the three places |
| B5 | Nav rail: "Affiliate" and "Billing" bottom icons both open Settings, and Billing appears twice (main rail + bottom) | `icon-rail.tsx` | drop Affiliate until it exists; bottom Billing → `/billing`; remove the duplicate |
| B6 | Marketing page says "Weekly and monthly performance reports" and "Powered by Claude" | `(marketing)/page.tsx` | only monthly reports exist; text AI may be Gemini now. Fix the copy or build the weekly email (autopilot plan 4.7) |
| B7 | Every notification emails every OWNER/ADMIN | `notification.service.ts` → `orgAdminEmails()` | per-user "email me" preference (phase 1) |

---

## 5. Build order

Phases are ordered so that each one is usable on its own, and so that phases 0–3 become the
prerequisites the autopilot plan already lists (delivery, approver phone, time zone, portal "This
week" tab). After phase 3 the autopilot plan can start at its phase 1 without re-planning.

### Phase 0 — Fix and unblock (1–2 days)

| Item | Files | Done when |
|---|---|---|
| B1 `ownerForPage()` returns null; prod cleanup SQL | `inbox.service.ts`, `data/go-live/README.md` | A Meta test send to an unconnected page is logged and dropped; probe rows gone |
| B2 route Claude-only features through `askAI()` | files in B2; `claude.client.ts` keeps `prepareClaudeSession` for the agent only | Weekly plan, triage, creative helper, competitor summary, report narrative all run on the env Gemini key; copilot says "needs an Anthropic key" |
| B3, B4, B5 copy + filters + nav | see table | No screen mentions `.env`; deleted clients never appear; rail has one Billing |
| `SocialCustomer.timeZone` (default `Asia/Kolkata`) + weekly plan anchors 09:00 in that zone | migration, `weekly-plan.service.ts`, portal date formatting | A plan generated for an IST client lands at 09:00 IST on the calendar |
| Prod env: `GEMINI_API_KEY`, `RESEND_API_KEY` | only you | Agent page shows "effective: gemini (env)" on prod; a test email arrives |

### Phase 1 — Login, access and delivery (3–4 days)

| Item | Build | Done when |
|---|---|---|
| L1 Password reset | `PasswordReset` table (userId, tokenHash, expiresAt, usedAt); `POST /api/auth/forgot` (always 200), `POST /api/auth/reset`; pages `/forgot-password`, `/reset-password?token=`; email via `mailer.sendEmail()`; same "shown once, hashed in DB" pattern as `invitation.service.ts` | You can reset your own password from the login page on prod |
| L2 Email the invite | `invitationService.createInvitation()` also calls `sendEmail()` when Resend is set; Team page keeps the copy box as fallback and shows "sent to x@y" | An invitee receives the link without you pasting it |
| L4 Member ↔ client access | `PUT /api/team/members/[id]/clients` (`SocialClientMember` upsert with permissions), Team page gets a "Clients" column with a picker per member and per-permission checkboxes (`view draft publish approve inbox ads_view ads_manage leads reports`); invite form gets the same picker and `acceptInvitation()` applies `clientAccess` | A MEMBER invited for client A sees only client A; the existing tenant-isolation tests cover a MEMBER with and without `publish` |
| D4 Approver management | `GET/POST/PATCH/DELETE /api/social/clients/[id]/approvers` ; `ClientApprover.phone` (E.164), `notifyEmail`, `notifyWhatsApp`, `lastLinkSentAt`, `lastLinkChannel`; client detail page section (phase 2) or a modal on the Clients page | Two approvers per client, one with a phone, editable without SQL |
| L3 Send the magic link | `POST /api/social/clients/[id]/magic-link` gains `{ approverId, channel: 'copy' \| 'email' \| 'whatsapp' }`: email = `sendEmail()` with a branded template; WhatsApp = `whatsappService.send()` text message from the agency's connection (template needed only once Meta's 24 h window rule bites; see autopilot plan 4.4); audit row + `lastLinkSentAt`; Clients page buttons "Copy", "Email", "WhatsApp" | Sending to yourself as the PodoSphere approver arrives on email and on +91 91191 05802 and opens the portal |
| P5 Client self-service link | `POST /api/approver/request-link` (email; always 200; sends only if an approver matches) + a small form on the expired portal page | A client with an expired session gets back in without you |
| L5 Staff session revocation | `User.tokenVersion`; embed in the session JWT; bump on password change / reset / role change / "log out everywhere" button in the user menu | Changing a member's role takes effect on their next request |
| B7 Notification preferences | `User.notifyEmail Boolean @default(true)`; `orgAdminEmails()` filters by it; toggle in the user menu | You can mute emails without losing in-app notifications |

### Phase 2 — Client-wise dashboard for the agency (3–4 days)

| Item | Build | Done when |
|---|---|---|
| D1 Clients table on Overview (All-clients mode) | `overviewService.byClient(scope)` → one row per client: followers, reach 28 d, posts due 7 d, drafts, approvals waiting (CLIENT step), inbox waiting, leads 28 d, ad spend 30 d, sync status (ok / error / stale > 24 h), last synced; "Open" sets the switcher (`PUT /api/social/client-scope`) and goes to that client's overview; sort by "needs attention" | One screen answers "which client needs me today" |
| D2 Client badge on rows | add `customerName` to the list DTOs for posts/calendar, inbox threads, leads, media when scope is `'all'`; small chip in `calendar-post-chip.tsx`, inbox list, leads list, media grid | No row is anonymous in All-clients mode |
| D3 Client detail page `/dashboard/social/clients/[id]` | tabs: **Overview** (the D1 row expanded + 28-day chart from `SocialInsightDaily`), **Channels** (linked integrations + ad accounts with last synced / errors / reconnect, "Unassigned" picker), **People** (approvers from phase 1, members with permissions, portal activity: last seen, last link sent), **Brand kit & AI** (existing editors, scoped), **Reports** (list + generate), **Portal & branding** (send link, preview portal, agency branding fields), **Settings** (time zone, AI monthly cap, status) | Everything about one client is reachable from one page; the current Clients list links to it |
| D5 Unassigned bucket | Channels page and the channels panel show an "Unassigned (n)" group when scope is `'all'`; each has "Assign to client…"; an Overview banner when `n > 0` | A freshly connected Page is never lost |
| D6 Freshness | `SocialSyncState` read into a `lastSyncedAt` + `status` per integration / ad account; shown on Channels, client detail and the portal; "Sync now" already exists for analytics | "Updated 12 min ago" everywhere numbers appear |
| L7 Branding settings | Settings → new "Branding" tab: logo upload (existing media storage), primary colour, portal title, custom domain (route exists), live preview of the portal header; `PUT /api/social/settings/branding` (OWNER/ADMIN) | An agency brands its portal without you |
| D9 Client status | `SocialCustomer.status` (`active` default, `paused`, `archived`); paused = workers skip it, archived = hidden from switcher and plan limits; buttons on the detail page | A churned client stops syncing and counting |

### Phase 3 — Client portal v2 (3–4 days; mobile-first, since clients open it from WhatsApp)

| Item | Build | Done when |
|---|---|---|
| P1 Overview | range picker 7 / 30 / 90 d; per-channel cards (followers, reach, engagement, posts); follower trend line from `SocialInsightDaily`; top 5 posts; "Updated x min ago" | Mirrors what the agency sees in Analytics for that client |
| P2 Approvals | media preview (image / carousel / video poster), channel + scheduled time in the client's zone, "Approve all", per-item approve / "Request changes" with a textarea modal (no `window.prompt`), optional inline caption edit flagged `edited_by_client`; everything still goes through `approvalService.portalDecide()` | A client approves a week from a phone in under a minute |
| P3 More tabs | **Upcoming** (approved + queued posts, read-only calendar list), **Reports** (`SocialClientReport` list with PDF download), **Inbox summary** (counts + SLA, read-only, optional) | The portal is somewhere the client comes back to, not only when nagged |
| P4 Branding | title, favicon, footer "Powered by Podo Social" (hidden on white-label plans), consistent with the Branding tab | Looks like the agency's product |
| Activity | `ClientApprover.lastSeenAt` already exists; add `portal_opened` / `approval.client_*` audit rows to the client detail "People" tab | You can see the client opened the link on Tuesday |

### Phase 4 — Website, first run, responsiveness (2–3 days)

| Item | Build | Done when |
|---|---|---|
| B6 Marketing copy | align features list with what exists; one "Platforms" row (FB, IG, LinkedIn, YouTube, GBP, Threads, Pinterest, WhatsApp; X / TikTok not yet); provider wording | No claim the product cannot keep |
| Public pricing page | `/pricing` from `plan.service.ts` plan definitions (Solo / Starter / Growth / Pro, limits); "Start free" → `/register` | A visitor knows what it costs before registering |
| First-run checklist | Overview shows a 4-step card for empty workspaces: create a client → connect a channel → fill the brand kit → first post or weekly plan; each step deep-links; disappears when done (reuse `onboardingStep`) | A new agency reaches a scheduled post without reading docs |
| L8 Responsive dashboard | `< md`: rail becomes a bottom tab bar (5 main items + "More"), channels panel becomes a drawer, header wraps (switcher + bell + menu), tables become cards on the key pages (overview, calendar list view, inbox, clients) | Overview, Calendar, Inbox, Clients and Agent usable on a phone |
| L6 Decide on email verification | optional: verify-email token on register with a 24 h grace | Decision recorded here |

### Phase 5 — Tests, smoke, ship (1–2 days)

| Item | Done when |
|---|---|
| Vitest: password reset token lifecycle, invite with `clientAccess`, member ↔ client assignment, approver CRUD + link delivery (mocked mailer / WhatsApp), `overviewService.byClient` on seeded data, portal request-link never leaks whether an email exists | green |
| `pnpm smoke` extended with `/login`, `/register`, `/pricing`, `/approver/portal` (expired state) | green on prod |
| Deploy: `pnpm db:deploy` → `pnpm build:deploy` → `pm2 reload` (web + worker), per `docs/ops-runbook.md` | each phase shipped separately, not as one big drop |

Total: about 14–18 working days for one developer. Phases 1 and 2 can run in parallel.
Then resume `PODO_SOCIAL_AUTOPILOT_PLAN.md` from its phase 1 (digest); its phase 0 and most of phase 3
are covered above.

---

## 6. Data model changes (all additive)

```prisma
model User {
  tokenVersion Int     @default(0)      // L5: embedded in the session JWT
  notifyEmail  Boolean @default(true)   // B7
}

model PasswordReset {                   // L1
  id        String   @id @default(uuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  @@index([userId])
  @@map("password_resets")
}

model ClientApprover {                  // D4 / L3
  phone           String?   @db.VarChar(20)   // E.164
  notifyEmail     Boolean   @default(true)
  notifyWhatsApp  Boolean   @default(false)
  lastLinkSentAt  DateTime?
  lastLinkChannel String?   @db.VarChar(16)   // copy | email | whatsapp
}

model SocialCustomer {                  // D7 / D9
  timeZone String @default("Asia/Kolkata") @db.VarChar(64)
  status   String @default("active") @db.VarChar(16)   // active | paused | archived
}
```

`Organization` needs nothing (branding fields exist). `SocialClientMember` needs nothing (API + UI
only). `Invitation.clientAccess` keeps its shape `[{ customerId, permissions[] }]` and is finally
applied in `acceptInvitation()`.

---

## 7. API routes to add or change

| Route | Phase | Who |
|---|---|---|
| `POST /api/auth/forgot`, `POST /api/auth/reset` | 1 | public |
| `POST /api/auth/logout-all` | 1 | staff |
| `PUT /api/team/members/[id]/clients` | 1 | OWNER/ADMIN |
| `GET/POST /api/social/clients/[id]/approvers`, `PATCH/DELETE …/approvers/[approverId]` | 1 | `approve` on the client |
| `POST /api/social/clients/[id]/magic-link` `{ approverId, channel }` | 1 | `approve` on the client |
| `POST /api/approver/request-link` | 1 | public (rate-limited, always 200) |
| `GET /api/social/overview/clients` | 2 | agency, scope `'all'` |
| `GET /api/social/clients/[id]` (detail), `PATCH …` (timeZone, status, aiMonthlyBudgetUsd) | 2 | OWNER/ADMIN; `view` for the detail |
| `GET/PUT /api/social/settings/branding` | 2 | OWNER/ADMIN |
| `GET /api/approver/overview?range=`, `GET /api/approver/upcoming`, `GET /api/approver/reports`, `POST /api/approver/posts/bulk` | 3 | portal session |

List DTO change (phase 2): posts, calendar, inbox threads, leads and media include `customerId` +
`customerName` (already joined for billing / API keys).

---

## 8. Things only you can do

- Put `GEMINI_API_KEY` (and later `RESEND_API_KEY`) in the production `.env`, then `pm2 reload` both
  apps. Without Resend, phase 1's emails are logged and skipped, as today.
- Run the probe cleanup SQL from `data/go-live/README.md` on production after B1 ships.
- Confirm the approver details for PodoSphere's own client (your email + WhatsApp number) so phase 1
  delivery is tested on you.
- Decide L6 (email verification) and whether the WhatsApp magic link goes out as plain text (works
  only inside a 24 h conversation window) or as a Meta-approved utility template (needs your yes to
  create it; see `no-changes-without-permission`).
- Rotate the Gemini key after testing and set it per client on the Agent page if you want a key per
  client instead of one server-wide key.

---

## 9. Decisions taken here (change them if wrong)

1. One server-wide Gemini key is the fallback; per-client keys on the Agent page still win.
2. The copilot agent stays on Claude (tool use); every other AI feature becomes provider-agnostic.
3. Client time zone defaults to Asia/Kolkata and lives on `SocialCustomer`.
4. Magic links are still one-time 72 h links with 12 h sessions; delivery and self-service requests are
   added, the token design is unchanged.
5. MEMBER permissions are the existing nine (`access.ts`); no new roles.
6. The client detail page replaces the inline forms on the Clients page over time; the list stays.

---

## 10. Launch gaps for selling subscriptions (added 10 Nov 2026)

Re-checked against the code on 10 Nov 2026: none of these exist yet. Phase numbers point to the build
order in section 5; items without a phase are new.

| # | Gap | Phase | Notes |
|---|---|---|---|
| G1 | No forgot password: a customer who forgets it cannot get back in | 1 (L1) | needs `RESEND_API_KEY` on prod to send the email |
| G2 | No "Sign in with Google" | **new, phase 1** | Google OAuth login on `/login` and `/register`; existing email + password stays; a Google login whose email matches an existing user logs into that user; a new email creates a workspace like `/register`. Needs the Google OAuth client (reuse `GOOGLE_CLIENT_ID` or a new one) with redirect `https://social.podospheretechnologies.com/api/auth/google/callback` added in Google Cloud (only you) |
| G3 | No `/pricing` page: visitors cannot see plans before signing up | 4 | built from `config/plans.ts` (Solo ₹1,499, Starter ₹4,999, Growth ₹9,999, Pro ₹19,999); "Start free" → `/register?plan=` |
| G4 | Invites and client portal links are not emailed; copied by hand | 1 (L2, L3, P5) | email first, WhatsApp later |
| G5 | A MEMBER cannot be given access to a client, so sees empty pages | 1 (L4) | Team page client picker + per-permission checkboxes |
| G6 | Dashboard does not work on a phone | 4 (L8) | bottom tab bar, drawers, cards |
| G7 | Customers cannot connect their own Facebook/Instagram/LinkedIn | **outside code** | Meta App Review for app 1425390532878774 (Advanced Access for pages/instagram permissions) and LinkedIn app keys (`LINKEDIN_CLIENT_ID/SECRET`) on prod. Start now; Meta takes weeks |

### Two workspaces for one company (found 10 Nov 2026)

Each login belongs to exactly one workspace (`User.organizationId`). Prod has at least two
PodoSphere workspaces: "Podosphere technologies" (Surbhi Trivedi's login, 115 channels, 52 active,
63 need attention) and "Podosphere Technologies" (`admin@podospheretechnologies.com`, no channels).
That is why the Clients form under the admin login says "No social channels connected yet".
Check with `pnpm db:audit-orgs` on the server (read-only). Fix by choosing one workspace to keep and
moving the other login into it (a data change on prod; only after an explicit yes).
