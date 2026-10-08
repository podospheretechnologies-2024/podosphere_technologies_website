# Podo Social: Accounts, Roles, Meta Data Sync and New Features

> Plan written 7 Oct 2026, from a read-only review of the code. Nothing in the code has changed yet.
> Read [PODO_SOCIAL.md](PODO_SOCIAL.md) first for the stack and the Meta setup.
> Never put tokens or secrets in this file.

**Contents**
1. [Problems in the code today](#1-problems-in-the-code-today)
2. [How competitors handle accounts and data](#2-how-competitors-handle-accounts-and-data)
3. [Account hierarchy: Super Admin → Business Admin → Member](#3-account-hierarchy-super-admin--business-admin--member)
4. [What each role sees](#4-what-each-role-sees)
5. [Meta data: sync into MySQL, serve from MySQL](#5-meta-data-sync-into-mysql-serve-from-mysql)
6. [Improving data quality per client](#6-improving-data-quality-per-client)
7. [New features](#7-new-features)
8. [Build order](#8-build-order)
9. [Open decisions](#9-open-decisions)

---

## 1. Problems in the code today

| # | Problem | Where | Severity |
|---|---|---|---|
| P1 | **Every logged-in user sees every ad account the system user can see, including client accounts.** Ads use one global `META_SYSTEM_USER_TOKEN` and call `me/adaccounts` with no organization filter. Registration is open, so anyone who signs up can see PodoSphere's 11 ad accounts and their spend. | `src/modules/social/server/ads/ads.service.ts` (`listAccounts`, `overview`), `src/app/api/social/ads/accounts/route.ts` | 🔴 Fix before any outside user gets a login |
| P2 | **Roles are never checked.** `UserRole` has `OWNER / ADMIN / MEMBER`, but no route checks it. A MEMBER can connect or disconnect channels, delete posts, change the brand kit, and so on. | `prisma/schema/core.prisma`, every route under `src/app/api/social/*` | 🔴 |
| P3 | **There's no Super Admin and registration is open.** Anyone can call `/api/auth/register`, which creates a new organization and makes them its OWNER. Nobody can create, suspend or support an organization from above. | `src/modules/auth/server/auth.service.ts` (`register`) | 🟠 |
| P4 | **There's no per-client access.** `SocialCustomer` groups channels by client, but users aren't linked to customers, so every member sees every client. | `prisma/schema/social.prisma` (`SocialCustomer`) | 🟠 |
| P5 | **Analytics and Ads call the Meta API on every page load.** Results are never stored. Pages are slow, they rely on timeouts (`ANALYTICS_BUDGET_MS`, `withBudget`), they use up rate limits, and history is lost once Meta stops keeping it. | `src/modules/social/server/analytics/analytics.service.ts`, `meta-history.ts`, `post-metrics.ts`, `ads.service.ts` | 🟠 |
| P6 | **There's no audit log.** Nothing records who connected, published, deleted or approved something. | — | 🟡 (needed for agencies and App Review) |

---

## 2. How competitors handle accounts and data

### 2.1 Account hierarchy

| Tool | Levels | How access is limited |
|---|---|---|
| **GoHighLevel** | Agency (Agency Admin / Agency User) → Sub-account per client (Account Admin / Account User) | Agency users can be limited to selected sub-accounts. Account users get permissions module by module (conversations, pipelines, …). Billing and global settings are agency-admin only |
| **Hootsuite** | Organization (Super Admin / Admin / Default) → Teams → social accounts | Members see only the social accounts assigned to their teams. "Limited" users can draft but not publish. Only a Super Admin can change another Super Admin's role |
| **Sprout Social / Agorapulse / Vista Social** | Organization → client groups (workspaces) → profiles | Permissions per profile (reply, publish, approve). Separate client "reviewer/approver" roles that don't use a paid seat |
| **Zoho Social (Agency plan)** | Agency → brands → client portal | Clients log in to a portal to approve posts and see branded reports |

**Pattern all of them share:** platform → tenant (agency) → client workspace → users with per-client access.
On top of that: a lightweight **client approver** role and an **audit log**.

### 2.2 Platform data

- **Sprout Social** syncs into its own database and backfills up to about **2 years** of Instagram profile metrics and up to
  **5 years / 10,000 posts** of post performance when a profile connects. It warns that some metrics (for example video views)
  take **24–72 h** to match the native numbers. **Stories can't be backfilled**: they must be captured on the day they're published.
- **Brandwatch, Statusbrew, Iconosquare, Orlo** all publish "data refresh rate" pages. Every metric type has its own sync
  frequency, and the UI shows when the data was last updated.
- None of them call the platform API when a user opens a report. Reports read from their own database.

---

## 3. Account hierarchy: Super Admin → Business Admin → Member

### 3.1 Levels

```
Platform: PodoSphere staff                    user.isPlatformAdmin = true        ← SUPER ADMIN
 └─ Organization: one agency or business      users.role = OWNER | ADMIN         ← BUSINESS ADMIN
     ├─ Client: SocialCustomer (exists)       channels + ad accounts belong to a client
     │   └─ Member access                     social_client_members(userId, customerId, permissions)  ← MEMBER
     └─ Client approver                       magic-link login, one client only, approve/comment only
```

| Level | Who | Can do |
|---|---|---|
| **Super Admin** | PodoSphere staff only | Create, suspend and delete organizations; set plan and limits; see platform health (sync errors, API usage, AI spend); **impersonate** a user for support (audited); assign Meta ad accounts to an organization while we still use our system user |
| **Owner** | Person who signed for the agency (one per organization, transferable) | Everything inside the organization, plus billing, deleting the organization and transferring ownership |
| **Admin** | Agency managers | Invite and remove members, create clients, connect and disconnect channels, assign channels and ad accounts to clients, set member permissions, edit brand kits |
| **Member** | Account managers, designers, interns | Only the clients they're assigned to, and only the permissions set for each client |
| **Client approver** | The agency's client | Sees their own calendar, approval queue and reports. Approves, rejects or comments. Doesn't use a paid seat |

**Why Super Admin is a flag rather than a fourth role:** a Super Admin isn't a member of any organization in the normal way.
Keeping it as a separate `isPlatformAdmin` flag means a bug in the organization role checks can never make someone a platform admin,
and organization queries stay simple.

### 3.2 Member permissions (per client)

Stored as a list on `social_client_members.permissions`:

| Permission | Allows |
|---|---|
| `view` | Calendar, posts, analytics for this client (implied by any other permission) |
| `draft` | Create and edit drafts. Drafts go to approval |
| `publish` | Publish or schedule without approval |
| `approve` | Approve other people's drafts |
| `inbox` | Read and reply in the unified inbox and WhatsApp |
| `ads_view` | See campaigns, spend and leads |
| `ads_manage` | Request pause, resume or budget changes (still goes through the approval queue and the safety rules in PODO_SOCIAL.md section 8) |
| `leads` | See and export leads, push them to PodoCRM |
| `reports` | Generate and send client reports |

Presets in the invite screen: **Viewer** (`view`), **Creator** (`draft`), **Manager** (`draft publish approve inbox reports`),
**Ads specialist** (`ads_view ads_manage leads`).

### 3.3 How accounts are created

| Flow | Steps |
|---|---|
| **New business (now)** | Super Admin creates the organization in `/admin/organizations` and enters the owner's email → invite email → the owner sets a password. **Turn off open `/register`** (or put it behind an invite code) until billing exists |
| **New business (later, self-serve)** | `/register` creates the organization with `status = TRIAL` and plan limits. Same as today, but with limits and a Super Admin view |
| **New member** | Owner or Admin → Team → Invite: email, role (ADMIN or MEMBER), the clients and the permission preset for each. The invite link expires in 7 days and only its SHA-256 hash is stored |
| **Client approver** | Admin → Client → "Invite approver": email → magic link. No password, a session scoped to one client |
| **Remove** | Soft-delete the user (`deletedAt`) and delete their sessions. Their posts stay. Their approvals stay in the audit log |

### 3.4 Enforcing it in code

All checks go in **one place**, next to `getCurrentOrganization()` in `src/shared/server/current-organization.ts`.
Routes never compare roles themselves.

```ts
// src/shared/server/access.ts (new)
export interface AccessContext {
  user: CurrentUser;
  organization: Organization;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  isPlatformAdmin: boolean;
  impersonatedBy: string | null;
  /** 'all' for OWNER/ADMIN; otherwise the customer ids this member can see. */
  clientIds: 'all' | string[];
  can(permission: ClientPermission, customerId: string | null): boolean;
}

export async function getAccess(): Promise<AccessContext>;               // 401 if no session
export async function requireRole(min: 'ADMIN' | 'OWNER'): Promise<AccessContext>;   // 403
export async function requireClient(customerId: string, p: ClientPermission): Promise<AccessContext>; // 403/404
export async function requirePlatformAdmin(): Promise<AccessContext>;    // 404, so the admin area stays hidden
```

Rules:
- Every repository query filters by `organizationId` **and**, for members, `customerId IN clientIds`. Posts are linked to a
  client through `SocialIntegration.customerId`.
- Return **404 rather than 403** when a member asks for a client they can't see, so client ids aren't leaked.
- Channels without a client (`customerId = null`) are visible only to OWNER and ADMIN until they're assigned.
- Super Admin routes live under `src/app/(admin)/admin/*` and `src/app/api/admin/*`, and each one calls `requirePlatformAdmin()`.
- Impersonation: the session carries `impersonatedBy`, a red banner shows in the UI, and every write is logged with both user ids.
- UI hiding (buttons, nav items) is a convenience only. The server check is the real one.

### 3.5 Schema changes (sketch)

```prisma
// core.prisma
enum OrganizationStatus { TRIAL ACTIVE SUSPENDED }

model Organization {
  // … existing fields
  status      OrganizationStatus @default(ACTIVE)
  plan        String             @default("agency_starter")
  maxClients  Int                @default(10)
  maxUsers    Int                @default(5)
}

model User {
  // … existing fields
  isPlatformAdmin Boolean @default(false)
  lastLoginAt     DateTime?
  clientMemberships SocialClientMember[]
}

model SocialClientMember {
  id             String   @id @default(uuid())
  organizationId String
  userId         String
  customerId     String
  permissions    Json     // ["view","draft","publish",…]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([userId, customerId])
  @@index([organizationId])
  @@map("social_client_members")
}

model Invitation {
  id             String    @id @default(uuid())
  organizationId String
  email          String
  role           UserRole
  clientAccess   Json      // [{ customerId, permissions }]
  tokenHash      String    @unique   // sha256 of the emailed token
  invitedById    String
  expiresAt      DateTime
  acceptedAt     DateTime?
  createdAt      DateTime  @default(now())

  @@index([organizationId])
  @@map("invitations")
}

model ClientApprover {
  id             String    @id @default(uuid())
  organizationId String
  customerId     String
  email          String
  name           String?
  lastSeenAt     DateTime?
  createdAt      DateTime  @default(now())

  @@unique([customerId, email])
  @@map("client_approvers")
}

model AuditLog {
  id              String   @id @default(uuid())
  organizationId  String?  // null for platform-level actions
  actorUserId     String?
  impersonatorId  String?
  action          String   // "channel.connect", "post.publish", "user.invite", "ads.pause.approved", …
  targetType      String?
  targetId        String?
  metadata        Json?
  ip              String?  @db.VarChar(64)
  createdAt       DateTime @default(now())

  @@index([organizationId, createdAt])
  @@map("audit_logs")
}
```

---

## 4. What each role sees

The same stored data, shown differently for each role.

| Screen | Super Admin | Owner / Admin | Member | Client approver |
|---|---|---|---|---|
| **Home** | Platform: organizations, active users, sync health, Meta API usage, AI spend, errors | Agency overview: all clients, totals, pending approvals, failing channels, team workload | "My clients": today's posts, my approvals, my unread inbox | Next 2 weeks of posts, items waiting for them |
| **Analytics** | Any organization (read-only, audited) | All clients plus **cross-client ranking** (which client grew most, best engagement rate) | Assigned clients only | Their own client only, in the branded report view |
| **Ads** | Ad account → organization assignment | All ad accounts mapped to their clients | Only if `ads_view` | Spend and leads summary only (optional, set per client) |
| **Inbox** | — | All clients, plus response time per member | Assigned clients with `inbox` | — |
| **Team** | All users in all organizations | Invite, remove, set permissions | — | — |
| **Audit log** | Everything | Their organization | Their own actions | — |

---

## 5. Meta data: sync into MySQL, serve from MySQL

**Rule: no dashboard page calls the Meta API while a user waits.** Pages read MySQL. Meta data comes in three ways:

### 5.1 Where data comes from

| Source | Data | How |
|---|---|---|
| **Webhooks** (real time) | FB/IG comments, Messenger and IG DMs, lead forms (`leadgen`), WhatsApp messages (already live) | `POST /api/webhooks/meta`: verify `X-Hub-Signature-256` → save to `webhook_events` → answer 200 → BullMQ job writes to the tables |
| **Scheduled sync** (BullMQ repeatable jobs in `src/worker`) | Posts, post metrics, Page/IG insights, ad structure, ad insights | See the schedule below. Each job is per channel or per ad account and records its state |
| **Backfill** (once, when a channel or ad account connects) | Older posts and insights | A low-priority job that pages back as far as Meta allows, then hands over to the scheduled sync |

### 5.2 Sync schedule

| Job | Frequency | Fetches | Why |
|---|---|---|---|
| `meta.posts.sync` | Every 2 h (every 30 min during business hours if needed) | New FB posts / IG media since the cursor, plus counts (likes, comments, shares) | New posts appear quickly |
| `meta.post-metrics.sync` | Posts < 7 days old: every 6 h. 7–30 days: daily. 30–90 days: weekly. Older: stop | Reach, impressions, saves, video views per post | Most engagement happens in the first week. This saves calls |
| `meta.stories.capture` | Every 4 h | Live IG stories plus their insights | **Stories disappear after 24 h and can't be backfilled** |
| `meta.insights.daily` | Daily, 03:00 in the client's time zone | Page/IG daily metrics (followers, reach, impressions, profile views) for the **last 3 days** (upsert) | Meta revises recent numbers for 24–72 h |
| `meta.ads.structure` | Every 2 h | Campaigns, ad sets, ads: status, budget, creative | Status changes show up the same day |
| `meta.ads.insights.today` | Hourly | Today's spend, impressions, clicks, leads per campaign | Overspend alerts (section 7) |
| `meta.ads.insights.daily` | Daily, 04:00 | Last **7 days** per campaign / ad set / ad (upsert) | Attribution keeps changing for several days |
| `meta.backfill` | Once per new channel or ad account | Page/IG: as far back as Meta returns (about 2 years). Ads: up to 37 months | After this we keep history ourselves, even when Meta drops it |
| `meta.token.check` | Daily | `debug_token` on each stored token | Mark `refreshNeeded` and show "Reconnect" before posts start failing |

Every job:
- runs with a per-channel BullMQ `jobId` (for example `meta.posts.sync:<integrationId>`) so the same job can't run twice at once;
- **upserts** on a unique key, so a re-run never creates duplicates;
- writes `social_sync_state` (last success, last error, next run);
- backs off when Meta's `X-Business-Use-Case-Usage` / `X-App-Usage` headers pass about 75%, and stops at 90%;
- uses field expansion, batch requests (`/?batch=`) for up to 50 posts at once, and **async insights jobs**
  (`POST act_x/insights` → poll `report_run_id`) for long ad date ranges.

### 5.3 New tables

```prisma
model SocialSyncState {
  id             String    @id @default(uuid())
  organizationId String
  integrationId  String?   // channel jobs
  adAccountId    String?   // ad jobs
  kind           String    // "posts", "post_metrics", "insights_daily", "ads_structure", "ads_insights", "backfill"
  cursor         String?   @db.Text
  lastRunAt      DateTime?
  lastSuccessAt  DateTime?
  lastError      String?   @db.Text
  failures       Int       @default(0)
  backfillDoneAt DateTime?

  @@unique([integrationId, kind])
  @@unique([adAccountId, kind])
  @@map("social_sync_states")
}

model SocialInsightDaily {
  id            String   @id @default(uuid())
  integrationId String
  date          DateTime @db.Date      // in the client's time zone
  metric        String                 // "followers", "reach", "impressions", "profile_views", …
  value         Decimal  @db.Decimal(20, 4)
  fetchedAt     DateTime @updatedAt

  @@unique([integrationId, date, metric])
  @@map("social_insights_daily")
}

model SocialExternalPost {           // every FB/IG post, including ones not published from our app
  id             String   @id @default(uuid())
  integrationId  String
  externalId     String              // Meta post / media id (string, never number)
  socialPostId   String?             // link to SocialPost when we published it
  type           String              // "post", "photo", "video", "reel", "story", "carousel"
  caption        String?  @db.Text
  permalink      String?  @db.VarChar(2048)
  thumbnailUrl   String?  @db.VarChar(2048)
  publishedAt    DateTime
  likes          Int?
  comments       Int?
  shares         Int?
  saves          Int?
  reach          Int?
  impressions    Int?
  videoViews     Int?
  engagementRate Decimal? @db.Decimal(8, 4)
  metricsAt      DateTime?

  @@unique([integrationId, externalId])
  @@index([integrationId, publishedAt])
  @@map("social_external_posts")
}

model AdAccount {
  id             String    @id @default(uuid())
  organizationId String              // ← fixes P1
  customerId     String?
  externalId     String              // "act_123…"
  name           String
  currency       String    @db.VarChar(3)
  timezone       String
  status         Int
  tokenSource    String    @default("system_user") // later: "org_business_token"
  createdAt      DateTime  @default(now())

  @@unique([externalId])
  @@index([organizationId, customerId])
  @@map("ad_accounts")
}

model AdEntity {                     // campaign / adset / ad
  id          String   @id @default(uuid())
  adAccountId String
  level       String                 // "campaign" | "adset" | "ad"
  externalId  String
  parentId    String?
  name        String
  status      String
  objective   String?
  dailyBudget Decimal? @db.Decimal(14, 2)
  updatedAt   DateTime @updatedAt

  @@unique([adAccountId, externalId])
  @@map("ad_entities")
}

model AdInsightDaily {
  id          String   @id @default(uuid())
  adAccountId String
  level       String
  entityId    String                 // externalId of campaign / adset / ad
  date        DateTime @db.Date      // in the ad account's time zone
  spend       Decimal  @db.Decimal(14, 2)
  impressions BigInt
  reach       BigInt
  clicks      Int
  leads       Int
  frequency   Decimal? @db.Decimal(8, 4)
  ctr         Decimal? @db.Decimal(8, 4)
  cpc         Decimal? @db.Decimal(14, 4)
  fetchedAt   DateTime @updatedAt

  @@unique([level, entityId, date])
  @@index([adAccountId, date])
  @@map("ad_insights_daily")
}
```

### 5.4 How the UI uses it

- Pages read the tables above through repositories. They load in milliseconds and never time out.
- Every card shows **"Updated 14 min ago"** from `social_sync_state.lastSuccessAt`.
- A **Refresh** button queues the relevant jobs at high priority. It's limited to once per 10 min per client
  (a Redis key `refresh:{customerId}`), and the UI polls until the job finishes.
- If a sync is failing, show it ("Instagram sync failing since 2 days: reconnect") instead of showing old numbers silently.

### 5.5 Moving Ads off the global token (fixes P1)

1. **Now:** create `ad_accounts` rows. A Super Admin (or Owner) assigns each ad account to an organization and client.
   `adsService.listAccounts()` reads `ad_accounts WHERE organizationId = …` and never `me/adaccounts`.
   `overview()` refuses any account that isn't in that list.
2. **Later (multi-agency):** each agency connects **its own** Business with Facebook Login for Business (`ads_read`,
   `business_management`). Store its token encrypted. `tokenSource = org_business_token`. PodoSphere's system user token
   is then used only for PodoSphere's own workspace.

### 5.6 Meta rules for stored data

- Caching and storing Platform Data is allowed for the service the user signed up for.
- **Delete** when a user asks or removes the app (promptly, **90 days at most**), when the data is no longer needed, when Meta
  asks, or if our platform access ends.
- So: disconnecting a channel or ad account → a job deletes its `social_external_posts`, `social_insights_daily`,
  `ad_*` rows and its tokens. The data-deletion callback (`src/app/api/meta/data-deletion/route.ts`) runs the same job
  and returns a confirmation code plus a status URL.
- Write the retention rule in the privacy policy (`src/modules/marketing/config/legal.ts`): "kept while connected, deleted
  within 30 days of disconnecting".
- Tokens stay AES-256-GCM encrypted and never go to the browser (already the rule).

---

## 6. Improving data quality per client

Once data is stored, we can make it better than Meta's own screens.

| Improvement | What it means | How |
|---|---|---|
| **Time zone per client** | "Monday" means Monday in the client's city, not UTC | `SocialCustomer.timezone`. Insights dates are bucketed in that zone |
| **Currency per ad account** | Spend in INR / USD without mixing | `AdAccount.currency`. Agency totals convert with a daily rate table, or are shown per currency |
| **One metric dictionary** | FB "reactions" and IG "likes" both count as `likes`; `engagement = likes + comments + shares + saves` | One `metrics.ts` map per provider. LinkedIn and YouTube use the same names later |
| **Follower growth history** | Daily follower snapshot, so "+120 this month" works even where Meta only returns the current value | `social_insights_daily` metric `followers`, written daily |
| **Engagement rate** | Engagement ÷ reach (or ÷ followers if reach is missing), the same formula everywhere | Calculated when syncing, stored on `social_external_posts` |
| **Posts not published from our app** | Analytics includes posts made in Meta Business Suite or on the phone | `social_external_posts` holds every post. `socialPostId` links the ones we published |
| **Lead source tracking** | Every lead knows its ad, ad set, campaign and form | Save `ad_id`, `adset_id`, `campaign_id`, `form_id` from the leadgen webhook |
| **UTM on every link** | Website traffic per post and per client | Composer adds `utm_source=<platform>&utm_campaign=<client>` automatically (setting per client) |
| **Data freshness and gaps** | We know if a day is missing | A nightly check marks gaps and queues a re-fetch |
| **Metric definitions** | Tooltip on every metric ("Reach = unique accounts that saw it") | So clients trust the numbers. Fewer "why does Meta show a different number" tickets |

---

## 7. New features

These are possible because we store data, have roles and run an AI agent. Grouped by the plan they'd sell in
(plans from PODO_SOCIAL.md section 18.5).

### 7.1 For agencies (Owner/Admin): the reasons they buy

| Feature | What it does | Uses | Plan |
|---|---|---|---|
| **Client approval links** | Client approves or comments on posts from a link, without logging in. Reminders go out on WhatsApp | `ClientApprover`, approval queue | Starter |
| **Automated monthly report** | PDF plus a web link per client: wins, losses, top posts, ad spend, leads, AI summary, next steps. Sent on the 1st after the agency approves it | Stored insights + Claude (Batch API) | Starter (agency logo) / Growth (white-label) |
| **Agency overview** | All clients on one screen: growth, engagement, spend, leads, pending approvals, failing channels, sorted by "needs attention" | Stored data | Starter |
| **Client health score** | 0–100 per client from posting consistency, engagement trend, lead trend and response time. Warns early about clients likely to leave | Stored data | Growth |
| **Team workload and SLAs** | Posts per member, average inbox reply time, approvals waiting, overdue items | Audit log + inbox | Growth |
| **Cross-client benchmarks** | "This clinic's engagement rate is in the top 20% of your healthcare clients." Later, anonymised across all agencies by industry | Stored data + industry tag on `SocialCustomer` | Growth / Pro |
| **Client portal** | Branded login for the client: calendar, reports, leads, approvals | Roles + white-label | Growth |

### 7.2 Alerts (the account manager hears about it before the client does)

Sent in the app plus on **WhatsApp to the account manager** (our own number, utility template):

| Alert | Rule (example) |
|---|---|
| Overspend | Today's spend > 120% of the daily budget, or month-to-date pace > budget |
| Cost per lead jump | CPL over the last 3 days > 1.5× the 14-day average |
| Ad fatigue | Frequency > 3 and CTR down > 30% versus the ad's first 3 days |
| Spend with no leads | Spend > ₹1,000 today and 0 leads on a lead campaign |
| Negative comment spike | More than 5 complaint-labelled comments in an hour (AI triage) |
| Channel broken | Token expired, or a post failed to publish |
| New lead not contacted | No reply within 10 min |

### 7.3 Leads and WhatsApp (strongest in India, where GoHighLevel and AiSensy only cover part of it)

| Feature | What it does |
|---|---|
| **Instant lead follow-up** | New Meta lead form → WhatsApp template within 60 s → AI qualifies the lead → hand-off to a person → PodoCRM |
| **Lead response time** | Shows time-to-first-contact per client and per member. Fast replies have the biggest effect on conversion |
| **Click-to-WhatsApp tracking** | Ties each WhatsApp chat back to the ad that started it (the referral data in the webhook) → cost per chat |
| **Broadcasts with a cost estimate** | Shows "this costs about ₹863 at Meta rates" before sending. Handles opt-outs |

### 7.4 Content (built on stored history)

| Feature | What it does |
|---|---|
| **Best time to post, per client** | From that client's own 90-day history, not general advice. Updates `SocialIntegration.postingTimes` automatically |
| **What works for this client** | AI looks at top and bottom posts (format, length, hook, hashtags, time) and writes 3 rules into the brand kit |
| **Reuse top posts** | Older top posts suggested as "repost or remake" with a fresh caption |
| **Hashtag performance** | Reach per hashtag across the client's posts |
| **Story archive** | We capture stories before they disappear, so reports include them |

### 7.5 Competitor tracking (requested)

| Feature | How | Limits |
|---|---|---|
| **Competitor Instagram tracking** | Instagram **Business Discovery** (`<IG_ID>?fields=business_discovery.username(x){followers_count,media_count,media{like_count,comments_count,timestamp,caption}}`) on the client's competitors (`brand_profiles.competitors`). Daily snapshot → growth and engagement compared with the client | Works only for Business/Creator accounts. No reach or impressions. Uses our own channel's token, so it counts against its rate limit |
| **Competitor Facebook Page public info** | Page public fields (name, followers) through Page Public Content Access | Needs a separate App Review feature. Check before promising it |
| **Competitor ads** | Meta **Ad Library**. The API mainly covers political/issue ads and ads shown in the EU, so for Indian commercial ads, link to the Ad Library website search | Don't promise full competitor ad data in India |
| **AI competitor brief** | Monthly: what competitors posted, what got engagement, what to try. From the snapshots plus Claude `web_search` | Read-only AI tool, no approval needed |

### 7.6 Platform (Super Admin)

| Feature | What it does |
|---|---|
| Organizations admin | Create, suspend, change plan, limits, impersonate (audited) |
| Sync health board | Failing jobs by organization and channel, Meta usage %, queue depth |
| AI cost per organization | From `SocialAiUsage`, compared with the plan price |
| Usage for billing | Clients, channels and users per organization, for plan limits and Razorpay |

---

## 8. Build order

Each step can ship on its own. Run `pnpm typecheck && pnpm lint` and test as each role before merging.

| Step | Build | Fixes / unlocks | Size |
|---|---|---|---|
| **1. Lock down** | Turn off open `/register` (invite only). Add `requireRole('ADMIN')` to every write route (channels, brand kit, webhooks, sheets, PodoCRM sync). `ad_accounts` table + Super Admin assignment, and Ads only shows assigned accounts | P1, P2, P3 | 2–3 days |
| **2. Roles** | `isPlatformAdmin`, `getAccess()` helpers, invitations, `social_client_members`, Team page, repositories filtered by client | P4 | 1 week |
| **3. Audit log** | `audit_logs` plus logging in the services | P6 | 2 days |
| **4. Ads sync** | `ad_entities`, `ad_insights_daily`, `social_sync_state`, jobs, Ads pages read from MySQL | P5 (biggest share of API calls) | 1 week |
| **5. Analytics sync** | `social_external_posts`, `social_insights_daily`, story capture, backfill, analytics reads from MySQL, "Updated X ago" + Refresh | P5 | 1–1.5 weeks |
| **6. Deletion** | Disconnect cleanup job connected to the data-deletion callback | Meta compliance, App Review | 1–2 days |
| **7. Approvals + client approver** | Approval queue, magic link, WhatsApp reminders | Section 7.1 | 1 week |
| **8. Alerts + reports** | Alert rules on stored data, monthly AI report | Sections 7.1, 7.2 | 1.5 weeks |
| **9. Super Admin area** | Organizations, sync health, usage, impersonation | Section 7.6 | 1 week |
| **10. Competitor tracking** | Business Discovery snapshots + AI brief | Section 7.5 | 1 week |

Steps 1–6 come before the pilot agencies log in (PODO_SOCIAL.md section 18.7, phase 1–2).

---

## 9. Open decisions

- [ ] Self-serve registration later, or invite-only until billing ships?
- [ ] Should a client approver also see ad spend? (Default: off, the agency turns it on per client)
- [ ] One Owner per organization, or several?
- [ ] Keep synced history how long after a channel is disconnected? (Proposal: delete within 30 days)
- [ ] When does each agency switch from PodoSphere's system user token to its own Business connection?
- [ ] Which permission presets do pilot agencies actually want? Ask the first 5.

---

## Sources

- GoHighLevel roles: [consultevo](https://consultevo.com/gohighlevel-admin-user-roles-permissions/), [supplygem](https://supplygem.com/gohighlevel-agency-sub-account/)
- Hootsuite: [organizations & permissions](https://education.hootsuite.com/pages/hootsuite-organizations-and-permissions), [user management](https://www.stitchflow.com/user-management/hootsuite/manual)
- Sprout Social: [metric discrepancies and backfill](https://support.sproutsocial.com/hc/en-us/articles/38269086191757-Troubleshooting-Metric-Discrepancies-Between-Sprout-Social-and-Native-Network-Reports)
- Refresh rates: [Brandwatch](https://social-media-management-help.brandwatch.com/hc/en-us/articles/20591905036317-Data-Refresh-Rates-in-Measure), [Statusbrew](https://statusbrew.com/help/articles/data-refresh-rates-post-insights), [Iconosquare](https://support.iconosquare.com/how-often-are-my-facebook-analytics-refreshed)
- Meta: [data deletion callback](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback), [Platform Terms FAQ](https://developers.facebook.com/documentation/development/terms-and-policies/faqs), [90-day deletion rule](https://conductatlas.com/platform/meta/meta-platform-policy/90-day-platform-data-deletion-obligation/)
