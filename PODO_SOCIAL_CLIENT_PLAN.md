# Podo Social — Client-wise Data & New Feature Plan

> Written 9 Oct 2026. Planning document only: nothing in this file has been built yet.
> Read with `PODO_SOCIAL.md` (sections 15–18) and `PODO_SOCIAL_ACCOUNTS_AND_DATA.md`. Read `AGENTS.md` before writing code (Next.js 16).
> Competitor notes describe **publicly visible product behaviour**. Their internal tech stacks are not public; re-check
> features on their sites before using any claim in marketing.

---

## 1. Goal

An agency (one `Organization`) manages many clients. Every piece of data — channels, posts, media, brand kit, inbox,
leads, WhatsApp, ads, analytics, reports — must belong to **one client**, so that:
- the agency can switch between clients or see **all clients** at once,
- a client user or approver only ever sees **their own** data,
- reports, AI and billing limits work **per client**.

---

## 2. How competitors handle clients

| Tool | Client model (public behaviour) | What we copy |
|---|---|---|
| GoHighLevel | Agency account → **sub-accounts**, one per client, fully separate. "Snapshots" clone a whole client setup into a new sub-account. Agency can rebill clients ("SaaS mode") | Hard client separation; **client templates** (clone setup); agency overview |
| Agorapulse | Organization → **workspaces** (one per client) → profiles. User roles are set per workspace. Shared calendar / approval with the client | **Per-client roles**; client switcher |
| Vista Social | **Profile groups** per client, roles per group, approval workflows, white-label (top plan) | Per-client approvals; white-label later |
| Sprout Social | **Profile groups**; report builder per group | Per-client report builder |
| Sendible | Client dashboards, client connects their own profiles via invite link, white-label | **Client self-connect link** (we already have this in the portal) |
| Zoho Social | **Brands** per client, client portal, branded reports (Agency plan) | Client portal + branded reports |
| AiSensy / Interakt | One WhatsApp Business Account per business; partners manage many client accounts | **One WhatsApp number per client** through Embedded Signup |

**The pattern:** Agency → Client workspace → connected profiles. Permissions, data, reports and limits hang off the
client workspace. The agency gets one combined view on top.

---

## 3. Where we are today (schema check, 9 Oct 2026)

`SocialCustomer` is our "client workspace". Models and whether they are client-scoped:

| Model | Client-scoped? | Problem |
|---|---|---|
| `SocialIntegration` (channels) | ✅ `customerId` (optional) | Optional: channels can exist without a client |
| `AdAccount` | ✅ `customerId` (optional) | Same |
| `SocialCompetitor` | ✅ `customerId` (optional) | Same |
| `SocialClientMember`, `ClientApprover` | ✅ | — |
| `SocialPost` | 🟡 only via `integrationId` | Drafts without a channel and agency-wide queries can't filter by client cheaply |
| `SocialExternalPost`, `SocialInsightDaily` | 🟡 only via `integrationId` | OK, but the join is needed for every report |
| `AdEntity`, `AdInsightDaily` | 🟡 only via `adAccountId` | OK |
| `SocialMedia` | ❌ organization only | One shared media library for all clients |
| `SocialBrandKit` | ❌ `organizationId @unique` | **One brand kit per agency.** AI writes every client's posts in the same voice |
| `SocialInboxThread` | ❌ organization only | Client users would see all clients' messages |
| `SocialLead` | ❌ organization only | Same |
| `SocialClientReport` | ❌ organization only | A "client report" with no client |
| `WhatsAppConversation`, `WhatsAppBroadcast` | ❌ organization only | — |
| `SocialWhatsAppConnection` | ❌ `organizationId @unique` | **Only one WhatsApp number per agency**; Embedded Signup per client is impossible |
| `SocialApiClient` | ❌ organization only | Fine for agency keys; client-limited keys later |

---

## 4. Target data model

### 4.1 Rules
1. Add `customerId String?` (indexed, `@map("customer_id")`) to every row that holds client data. Keep `organizationId` too:
   it stays the tenant boundary, and `customerId` is the client boundary inside it.
2. `customerId` is **set by the server**, never taken from the request body without checking that the client belongs to
   the session's organization (same rule as `organizationId`).
3. Platform data gets its client from its source: webhook → Page/IG/WABA ID → `SocialIntegration`/`SocialWhatsAppConnection`
   → `customerId`. Ads → `AdAccount.customerId`.
4. `customerId = null` means "agency's own data" (PodoSphere itself). Each organization gets one default "Agency" client in
   the backfill so that every channel ends up with a client.

### 4.2 Schema changes (`prisma/schema/social.prisma`)
| Model | Change |
|---|---|
| `SocialPost` | + `customerId` (copied from the integration when the post is created) |
| `SocialMedia` | + `customerId` (null = shared agency library) |
| `SocialBrandKit` | Drop `organizationId @unique`; + `customerId`; `@@unique([organizationId, customerId])` |
| `SocialInboxThread`, `SocialLead`, `SocialClientReport` | + `customerId`, index `[organizationId, customerId, createdAt/lastMessageAt]` |
| `WhatsAppConversation`, `WhatsAppBroadcast` | + `connectionId` → `SocialWhatsAppConnection` (which carries `customerId`) |
| `SocialWhatsAppConnection` | Drop `organizationId @unique`; + `customerId`; `@@unique([phoneNumberId])` |
| `SocialCustomer` | + `slug`, `logoUrl`, `timezone`, `currency`, `status` (active/paused/archived), `planClientSlot` |
| New `SocialClientTemplate` | Saved client setup to clone: brand kit, tags, signatures, sets, posting schedule, report settings |

Migration steps (one migration per step, each with a backfill script in `scripts/`):
1. Add nullable columns and indexes.
2. Backfill: create an "Agency" client per organization; set `customerId` from integration/ad account; leave media `null`.
3. Switch reads to the scope helper (4.3), then add the new unique constraints.

### 4.3 One scope helper for every query
```ts
// src/shared/server/client-scope.ts (server-only)
type ClientScope = { organizationId: string; customerIds: string[] | 'all' };
async function getClientScope(request): Promise<ClientScope>
```
- Owner/Admin: `'all'`, or the one client picked in the client switcher (cookie or `?client=`).
- Member: only clients they are a `SocialClientMember` of.
- Client user / approver (portal): exactly one client.

Every repository takes a `ClientScope` instead of a bare `organizationId`, and builds
`where: { organizationId, ...(ids === 'all' ? {} : { customerId: { in: ids } }) }` in **one** place.
Add Vitest tests: a Member of client A gets 0 rows from client B for every list endpoint.

---

## 5. New features (by priority)

### P1 — client-wise basics (do first; needed before external pilots)
| Feature | Competitor reference | How we build it (our stack) |
|---|---|---|
| **Client switcher** in the dashboard header + "All clients" | Agorapulse workspaces, GHL sub-accounts | Server component reads the scope cookie; TanStack Query keys include `customerId` so caches don't mix |
| **Agency overview** (all clients on one page: followers, spend, leads, posts due, approvals waiting, sync errors) | GHL agency view | One aggregate service reading stored MySQL data (`SocialInsightDaily`, `AdInsightDaily`, `SocialSyncState`), never live Meta calls |
| **Per-client brand kit** | Every competitor with AI | Schema change above; `askClaude()` loads the kit of the post's client; prompt cache key per client |
| **Per-client approvals** (multi-step: internal review → client approve) | Vista Social, Agorapulse | Approval rows with `customerId` + step; magic link only shows that client's queue |
| **Client report per client** (monthly PDF + link) | Sprout, Zoho, Sendible | BullMQ job per client; data from MySQL; PDF with `@react-pdf/renderer` (decision needed); store in uploads; approve before send |

### P2 — agency efficiency
| Feature | Competitor reference | How we build it |
|---|---|---|
| **Client templates** (clone setup into a new client) | GHL snapshots | `SocialClientTemplate` JSON + "Create client from template" service, inside a Prisma transaction |
| **Client onboarding wizard** (create → send connect link → pick Pages/ad account/WhatsApp → brand kit) | Sendible client connect | Reuse portal connect + magic link; track steps on `SocialCustomer` |
| **WhatsApp number per client** (Embedded Signup) | AiSensy / Interakt | `SocialWhatsAppConnection` per client; webhook routes by `phone_number_id`; needs Tech Provider + App Review |
| **Unified inbox per client** with assignment to a team member and SLA timer | Agorapulse, Vista Social | `customerId` + `assigneeId` on threads; Meta webhook maps Page/IG ID → client |
| **Lead pipeline per client** (stages, push to PodoCRM) | GHL | `stage` on `SocialLead`; Kanban UI; PodoCRM sync per client |
| **Scheduled report delivery** (email / WhatsApp to the client) | Sendible, Sprout | Email provider needed (decision: Resend or Amazon SES); WhatsApp via an approved utility template |

### P3 — differentiators (after pilots)
| Feature | How |
|---|---|
| **AI weekly plan per client** (next week's posts from brand kit + top posts) | BullMQ weekly job per client → drafts into the approval queue |
| **AI report narrative** (wins / losses / next steps per client) | Claude structured output over stored metrics; human approves |
| **White-label** (agency logo, colours, custom domain for portal) | `proxy.ts` host lookup → organization branding; TLS for custom domains needs a decision (Caddy on-demand TLS on the VPS is the simplest with PM2) |
| **Plan limits per client slot** (Solo 3, Starter 10, …) | `planService.assertFeature` + client count check on create |
| **Client-limited API keys** | `SocialApiClient.customerId` optional; `/api/v1/*` applies the same scope helper |

---

## 6. Build order and gates

| Step | Work | Done when |
|---|---|---|
| 1 | Schema step 1 + backfill (4.2) | Every channel/ad account has a client; old screens still work |
| 2 | `getClientScope()` + move all repositories to it | Isolation tests pass for every list/read endpoint |
| 3 | Client switcher + per-client brand kit | Switching client changes every page; AI uses the right voice |
| 4 | Per-client inbox, leads, reports, media | Webhooks land in the correct client; portal shows only its client |
| 5 | Agency overview + monthly report job | Report for 3 PodoSphere clients generated from MySQL only |
| 6 | P2 features (templates, onboarding, WhatsApp per client, delivery) | 3–5 PodoSphere clients onboarded with the wizard |
| 7 | P3 features | After external pilot feedback |

Still required before any of this reaches outside agencies (see `PODO_SOCIAL.md` 18.7): Ads tenant isolation,
working Meta sync workers, App Review, lint clean, and the end-to-end client flow test.

---

## 7. Decisions needed
- [ ] PDF library for reports: `@react-pdf/renderer` (pure JS, recommended) or headless Chrome (exact look, heavier)
- [ ] Email provider for report delivery and invites: Resend or Amazon SES
- [ ] Custom domains for white-label: Caddy on-demand TLS, or keep one domain with per-agency subdomains first
- [ ] Is media shared across clients by default, or private per client?
- [ ] Plan limits: count clients, connected profiles, or both?

---

## 8. Existing code review: how client-user data is handled today (9 Oct 2026)

Read-only review of `src/shared/server/access.ts`, `current-organization-or-client.ts`, the approver routes,
`approvals/approval.service.ts`, `clients/[id]/magic-link` and the repositories. No code was changed.

### 8.1 What exists
| Piece | Where | What it does |
|---|---|---|
| `getAccess()` | `src/shared/server/access.ts` | Loads user, role, platform-admin flag, impersonation (`podo_impersonate` cookie) and, for MEMBER, the client IDs + per-client permissions from `SocialClientMember` |
| `requireRole` / `requireClient` / `requirePlatformAdmin` | same file | Role gate, per-client permission gate (404 to hide existence), platform admin gate |
| Client scope in queries | `post.repository.ts` (`list`, `listRange`), `integration.repository.ts` (`list`) | Filters by `clientIds` from `getAccess()` |
| Client portal session | `approval.service.ts`, `/api/approver/verify`, `/api/approver/channels` | Magic link = 7-day HS256 JWT (`sub` approver, `org`, `cust`); the same token is stored as the `approver_session` cookie |
| Portal or agency | `current-organization-or-client.ts` | Agency session first, else approver session → `{ organization, customerId }`. Used by integration connect/callback |

### 8.2 Problems found
| # | Problem | Why it matters | Fix |
|---|---|---|---|
| C1 | **54 routes use `requireRole('ADMIN')`; `requireClient()` is used by 0 routes** | MEMBER users are blocked from everything (403), so per-client member permissions (`draft`, `publish`, `inbox`, `ads_view`, …) are never used. "Roles enforced" today means "members can't use the app" | Replace `requireRole('ADMIN')` on client-data routes with `requireClient(customerId, '<permission>')` (or the scope helper for list routes). Keep `requireRole` only for agency settings, billing, team, API keys |
| C2 | **Repositories call `getAccess()` themselves** (reads cookies) | Fails with 401 outside a logged-in request: BullMQ worker, webhooks, client portal session. Hides the scope from the caller and runs the membership query on every call | Pass a `ClientScope` object from the route into services/repositories (section 4.3). Repositories never read cookies |
| C3 | Only 3 repository functions apply client scope | Inbox, leads, reports, media, WhatsApp, analytics, ads lists are organization-wide (and the tables have no `customerId`, section 3) | Section 4 schema change + scope helper everywhere; Vitest test per list endpoint |
| C4 | **Magic link JWT is signed with `SESSION_SECRET`** with no audience/type claim | Same key signs user sessions and approver links; a token of one kind could be tried as the other | Separate `APPROVER_TOKEN_SECRET` (or add and check `aud: 'approver'` / `typ`), plus `iss` |
| C5 | **Magic links can't be revoked** and are not checked against the DB | Removing an approver or archiving a client leaves a working 7-day link | Store a token ID (`jti`) or `tokenVersion` on `ClientApprover`; `verifyToken` checks the approver still exists, is active and the version matches |
| C6 | The 7-day link token is reused as the session cookie | A link forwarded in WhatsApp/email is a 7-day login; token sits in the URL (browser history, proxy logs, referrer) | Exchange the link for a fresh short session (e.g. 12 h) on first use; make the link single-use and short-lived (e.g. 72 h) |
| C7 | `POST /api/social/clients/[id]/magic-link` only checks the client is in the organization | Any logged-in member could generate a portal link for any client; always uses the **first** approver; errors return `error.message` with 500 | `requireClient(id, 'approve')` or `requireRole('ADMIN')`; choose the approver by ID; use `errorResponse()`; write an `AuditLog` row |
| C8 | Approver routes read `approver_session` and verify the token in each route | Logic is duplicated; easy to forget scope on a new portal route | One `getPortalSession()` helper returning `{ organizationId, customerId, approverId }`, used by every `/api/approver/*` route |
| C9 | Impersonation via `podo_impersonate` cookie | Must be visible and audited | Banner in the UI, `AuditLog` on start/stop, time limit, never allow write actions on billing while impersonating |
| C10 | `can()` treats any permission as `view` | Fine, but undocumented | Document the permission matrix (who can do what) next to `ClientPermission` |

### 8.3 Target flow for client users
```
Agency user (OWNER/ADMIN)  → getAccess() → scope = all clients, or the client chosen in the switcher
Agency MEMBER              → getAccess() → scope = SocialClientMember rows → per-route requireClient(permission)
Client approver (portal)   → getPortalSession() → scope = exactly one customerId, read + approve only
Worker / webhook           → no session; scope comes from the job data (integrationId → customerId), never from getAccess()
```
Acceptance tests (Vitest, `src/shared/server/access.test.ts` exists already):
- MEMBER of client A: lists for posts, channels, inbox, leads, reports, media, analytics, ads return only client A rows
- MEMBER without `publish` on client A cannot publish; with it, can
- Approver of client A cannot read client B by changing an ID in the URL (expects 404)
- Removed approver's link and cookie stop working immediately
- Worker jobs run without a request context

---

## 9. Meta API responses → client data (checked against `PODO_SOCIAL_ACCOUNTS_AND_DATA.md`)

`PODO_SOCIAL_ACCOUNTS_AND_DATA.md` section 5 is the plan for how Meta responses are stored. To make that data client-wise:

| Meta source | Arrives with | Map to client by | Status |
|---|---|---|---|
| Page/IG posts, insights (worker sync) | Page ID / IG user ID | `SocialIntegration.customerId` | Tables exist; worker fixes in progress (see `PODO_SOCIAL.md` "Meta data sync review") |
| Ads structure + insights (worker sync) | `act_…` ad account ID | `AdAccount.customerId` | Tables exist; still uses the global system-user token |
| Comments, DMs (`/api/webhooks/meta`) | `entry[].id` = Page ID or IG user ID | integration → `customerId` stored on `SocialInboxThread` | Route exists; threads have no `customerId` yet |
| Lead forms (`leadgen` webhook) | Page ID + `form_id`, `ad_id` | Page → integration → `customerId` (fallback: `ad_id` → ad account) | `SocialLead` has no `customerId` yet |
| WhatsApp messages (`/api/webhooks/whatsapp`) | `metadata.phone_number_id` | `SocialWhatsAppConnection.customerId` | Connection is one per organization today |
| Data-deletion callback | Meta user ID | All rows of that user's integrations, per client | Implemented in `0805270`; re-test once `customerId` is added |

Rules for every response handler:
- Resolve `customerId` from the **platform ID in the payload**, never from anything the sender controls.
- If no integration matches, store the event as unassigned (`customerId = null`) and alert; never guess a client.
- Validate response shapes with zod instead of `any`; store the raw webhook body in `webhook_events` for replay.
- Keep `fetchedAt` / `SocialSyncState` per client so each client's dashboard can show "Updated x min ago".
