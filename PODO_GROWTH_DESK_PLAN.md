# Podo Social — Growth Desk (the "Siyara Ads Bot" inside the product) — plan, 10 Nov 2026

## Build status (10 Nov 2026)

Decisions: D1 = every client. D2 = custom-app token (client ID + secret also supported). D3 = built now.
D4 (import Siyara's artifact data) and D5 (client-portal approvals) are not done yet.

Built (uncommitted): phases 0–8 in one pass. Page `/dashboard/social/growth` (nav "Growth"); all-clients
summary when no client is picked; per-client desk with tabs Today, Idea box, Review, Performance, Campaign
plan, Content, Blogs, Images, Website, Ideas, Change log, Reports, Setup.

| Area | Where |
|---|---|
| Schema (12 tables + 3 columns on `ad_insights_daily`) | `prisma/schema/growth.prisma`, migration `20261110120000_growth_desk` |
| Meta purchases / revenue / add-to-cart + one-time 90-day backfill | `server/ads/ads-ecommerce.ts`, `ads.worker.ts` |
| Shopify client + connect + 60-day sync + ShopifyQL traffic | `server/growth/shopify.client.ts`, `shopify.service.ts` |
| Overview / ROAS / all-clients summary / goals | `server/growth/growth.service.ts` |
| Tasks + review state machine | `server/growth/tasks.service.ts`, `task-transitions.ts` |
| Change log, insights, ad plan, blogs (+ publish), briefs, videos, reports, content tracker + post tasks | `server/growth/records.service.ts` |
| All AI (insights, ad plan, blog ideas/drafts, idea box, content + video ideas, reports) via `askAI()` | `server/growth/growth-ai.service.ts` |
| Worker: store sync 3 h, post→task sync 1 h, daily insights after 08:00 IST | `server/growth/growth.worker.ts` (registered in `src/worker/index.ts`) |
| API | `src/app/api/social/growth/**` (27 route files) |
| UI | `src/modules/social/components/growth/*` |
| Tests | `growth-metrics.test.ts`, `task-transitions.test.ts`, `growth-isolation.test.ts`, `ads-ecommerce.test.ts` |

Checked: `tsc` clean, eslint clean on new code, 111+ vitest tests pass, `next build` passes.
Not yet checked: the migration against a live MySQL (Docker was off), a real Shopify store, ShopifyQL
field names (risk R1), and AI output quality.

### Setup steps (owner)

1. Database: start Docker Desktop → `pnpm db:migrate` (local). Production: `pnpm db:deploy`.
2. Production: rebuild + pack (`pnpm build:deploy`), then `pm2 reload` BOTH web and worker.
3. Optional env: `SHOPIFY_API_VERSION` (default `2026-07`). AI features need `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` / `OPENAI_API_KEY` on prod.
4. Per client: assign the Meta ad account to the client (Ads page), then Growth → Setup → connect Shopify, set target ROAS / budget / brand facts.

### Shopify token per client

A. Store admin still offers "Develop apps" (legacy custom app):
Shopify admin → Settings → Apps and sales channels → Develop apps → Allow custom app development →
Create an app ("Podosphere Growth Desk") → Configuration → Admin API integration → scopes `read_orders`,
`read_reports`, `read_content`, `write_content` → Save → Install app → API credentials → reveal the Admin
API access token (`shpat_…`, shown once) → paste with the store's `xxx.myshopify.com` address in
Growth → Setup → "Admin API access token".

B. Store only allows Dev Dashboard apps (new custom apps moved there from 2026):
dev.shopify.com → create app → set the same scopes → release a version → install it on the client's store →
copy Client ID + Client secret → Growth → Setup → "Client ID + secret". The desk exchanges them for
short-lived tokens itself. Screen names may differ slightly.

### Google Analytics (GA4), added 10 Nov 2026, uncommitted, not tested against a live property

Connected like Meta / Google Ads: one Google login per organization (scope `analytics.readonly`). It
lists every GA4 property that login can read, and each property is assigned to one client. Read-only.

- Code: `prisma/schema/ga4.prisma` + migration `20261110160000_ga4`, `server/growth/ga4.client.ts`
  (Admin API discovery, Data API `runReport` / `batchRunReports`, parsers), `ga4.service.ts`, routes
  `/api/social/growth/ga4` (+ `connect`, `callback`, `properties`, `sync`), UI `components/growth/growth-ga4.tsx`
  (Setup panel + Website-tab section), worker jobs `growth.ga4.syncAll` (every 3 h) and `growth.ga4.syncProperty`.
- Stored per client: `ga4_daily_metrics` (90 days: sessions, users, new users, engaged sessions,
  add to cart, checkout, purchases, purchase revenue, key events) and `ga4_traffic_snapshots`
  (last 30 days by channel, source / medium, landing page, device). These rows will feed the client portal's Analytics tab.
- Isolation: one property per client (unique `customerId`); a property already used by another client is
  refused (409) and hidden from the picker; when a property changes client, its synced rows are deleted.

Setup (owner):
1. (Changed 11 Nov 2026) GA4 runs on its own OAuth client in the company project `podo-social-ads`
   (org `podospheretechnologies.com`), not the personal project of `GOOGLE_CLIENT_ID`. There: enable
   **Google Analytics Admin API** and **Google Analytics Data API**; keep the consent screen **Internal**
   (no review, no 7-day token expiry); create a Web OAuth client with redirect URI
   `<APP_URL>/api/social/growth/ga4/callback`; set `GOOGLE_GA4_CLIENT_ID` / `GOOGLE_GA4_CLIENT_SECRET` on the
   server. Connect as **info@podospheretechnologies.com** (an org account is required with Internal).
   Unset GA4 vars fall back to `GOOGLE_CLIENT_*`.
2. `pnpm db:migrate` (local) / `pnpm db:deploy` (prod), then reload web + worker.
3. Growth → pick a client → Setup → **Connect Google Analytics** (owner/admin).
4. In each client's GA4: Admin → Property access management → add **info@podospheretechnologies.com** as **Viewer**.
   Then press Refresh list in Setup, pick the property, and press Sync now.
5. Purchase / revenue numbers only show when the site sends GA4 e-commerce events (`add_to_cart`, `begin_checkout`, `purchase`).

### Content calendar from Google Sheets, added 10 Nov 2026, uncommitted, not tested against a live sheet

This reuses the existing org-wide **Google Sheets** login from Plugs (scopes `spreadsheets.readonly` + `drive.readonly`).
Each client links its own content calendar sheet, and can be limited to one tab when a master sheet holds every client.
It is read-only and never writes to the sheet.

- Code: column `contentSheetTab` on `social_growth_settings` (migration `20261110200000_content_sheet_tab`);
  `server/growth/content-sheet.service.ts`; routes `/api/social/growth/content-sheet` (GET rows, PUT link) and
  `/content-sheet/options` (picker list); in `google-sheets.service.ts`: `clientSpreadsheet` (reads one sheet live, cached 15 min),
  `listLite`, `filterSheetRows` and a scoped `contentForDate`; UI `components/growth/growth-content-sheet.tsx`
  (a Setup panel, plus a section on the Content tab).
- Content tab: dated rows from 2 weeks back to 60 days ahead, with the Platform / Format / Status columns when the sheet has them.
  Each row is marked "In Calendar" when a post for this client exists that day, otherwise "Not scheduled".
- Isolation (this also fixes the old composer behaviour): when a client is picked, the composer's "fill from Sheets"
  uses only that client's sheet or tab. Sheets and tabs linked to other clients are hidden from `/api/social/google-sheets`,
  `/content` and `/spreadsheets/[id]`. "All clients" (owner/admin, nothing picked) is unchanged.
- Connecting from Growth → Setup now sends the user back to the Growth Desk (OAuth state carries `returnTo`).

Setup (owner):
1. In the Google Cloud project of `GOOGLE_CLIENT_ID`, enable the **Google Sheets API** and **Google Drive API**. On the OAuth client,
   add the redirect URI `<APP_URL>/api/social/google-sheets/callback`.
2. `pnpm db:migrate` / `pnpm db:deploy`.
3. Growth → client → Setup → Content calendar → **Connect Google Sheets** (owner/admin, once).
4. Share each client's sheet with that Google account (Viewer). Then pick it from the list, or paste its link, and choose a tab if needed.

---

Source: the claude.ai artifact "Siyara Ads Bot" (https://claude.ai/artifact/R2huQoNMzAWLHfaDibSY6K).
It is a single HTML page that keeps its data in the artifact's own database and is filled by a chat
bot. This plan turns it into a proper, per-client module of Podo Social so it works for Siyara Beauty
first and for every other e-commerce client after that. Nothing is built yet.

**Answer: yes, it can be built here.** About half of it already exists in some form (Meta ads sync,
post calendar + approvals + publishing, competitors, reports with PDF, AI helpers, media, branded
templates, client scoping). The big missing pieces are a **Shopify connection**, **purchase/revenue
data from Meta**, a **task + review system**, and **blogs**.

---

## 1. What the artifact does, tab by tab, mapped to this repo

| Artifact tab | What it does | Already in this repo | Gap to build |
|---|---|---|---|
| Hero (ROAS vs target, KPIs, "needs you" buttons, daily budget) | Shopify sales ÷ Meta spend vs a 10x target; sales, orders, AOV, sessions, cart rate | Meta ad spend per day in `AdInsightDaily` (`ads.worker.ts`) | Shopify sales/orders/sessions; client goals (target ROAS, daily budget, budget cap) |
| Today: tasks + "What the bot noticed" | Daily tasks for the marketer by area and priority; marker ticks → goes to review | `server/alerts`, lead assignee pattern | **New task model** + insights job |
| Review | Owner approves done tasks or sends back with a note | Post approval state machine (`approval-transitions.ts`) as a pattern | Task review states |
| Performance | Campaign table with purchases, revenue, ROAS, cost/purchase, ATC; sales vs spend chart; day-by-day table | `ads-manager.tsx`, campaign/adset/ad insights | `AdInsightDaily` stores only `leads` — add `purchases`, `purchaseValue`, `addToCart` from `actions`/`action_values`; join with Shopify daily |
| Campaign plan | Bot proposes campaign → ad set → ad (copy, audience, landing page); owner approves/rejects; marketer builds in Ads Manager, marks live; copy buttons | `creative-helper.service.ts` queues `queue_ad_creative` actions (`SocialAiAction`) | Group by campaign/ad set, approve/reject/live states, copy buttons |
| Content (posting tracker) | created → approved → scheduled → posted → results; each step creates a task for designer/editor/SMM; boost flag; manual metrics | `SocialPost` + calendar + approval steps + real publishing; `SocialExternalPost` already pulls reach/likes/saves automatically | Stage-driven tasks, boost flag + budget; "ideas from results" AI |
| Blogs | 5 SEO blogs/month, draft → approve → publish to the Shopify blog | nothing | **New**: blog model, AI draft, approval, publish via Shopify Admin API |
| Images | Canvas creative from product photos, sizes (4:5, 1:1, 9:16, blog cover), styles, download PNG | branded templates (`branded-templates.ts`), image presets, media library, AI images | Add a "product photo" template with those sizes; pick text from a blog/ad/post |
| Website | Store funnel (sessions → ATC → orders), landing pages, sources, devices; website tasks | nothing | Shopify analytics (see risk R1) |
| Ideas | AI video scripts with step-by-step prompts; competitor references | competitors (`SocialCompetitor` + snapshots), AI presets | Video-idea AI preset |
| Change log | Manual log of changes in Ads Manager / store so the bot can judge them next day | `AuditLog` (app actions only) | Manual per-client change log |
| Idea box | Owner types a rough idea → AI brief (ideas, script, copy, tasks) → "add as tasks" | AI threads / copilot, `askAI()` in `claude.client.ts` | Brief preset + "add as tasks" |
| Reports | 15-day report: KPIs, insights, done work, 30-day plan | `SocialClientReport` monthly, PDF, AI narrative, email | 15-day cadence option + e-commerce KPIs + plan-of-action section |

Rule kept from the artifact and from our safety rules: **the system only guides.** It never changes
ads or the store by itself. The only write to an outside system is publishing an approved blog, and
that happens only when a person presses Publish.

---

## 2. Build phases

Each phase ships on its own. Estimates are dev days.

**Phase 0 — Shopify connection (3–4 days)**
- `SocialShopifyStore` per client: shop domain, Admin API token (AES-GCM like `AdAccount`), scopes, sync state.
- Connect screen under Channels: paste a custom-app token (pilot) — see decision D2.
- Daily sync job (BullMQ, same pattern as `ads.worker.ts`): orders, net sales, AOV, cancelled/COD flags into `ShopifyDailyMetric` (client, date, orders, sales, sessions, atc, currency, store time zone).

**Phase 1 — Real ROAS (2 days)**
- Add `purchases`, `purchaseValue`, `addToCart` to `AdInsightDaily`; request `action_values` in the insight calls; backfill 90 days.
- `SocialClientGoals`: target ROAS, daily budget, budget cap, edited from the client page.
- "Growth" page per client: hero (Shopify ROAS and Meta-reported ROAS side by side), date presets, campaign table with revenue/ROAS/CPP/ATC, sales-vs-spend and traffic charts, day-by-day table.

**Phase 2 — Tasks, review, change log (3 days)**
- `SocialTask`: client, area (ads / website / content / smm / seo), priority, status (todo → review → done, or sent back), assignee, due date, links to post/creative/blog, done note, review note.
- Today view (my tasks, by area), Review queue for OWNER/ADMIN, badges in the nav, notification on new tasks.
- `SocialChangeLog`: where / what / why / who, per client.

**Phase 3 — Campaign plan approvals (2–3 days)**
- Extend creative helper output with campaign name, ad set name, audience, landing page, placements, rationale.
- Plan view grouped campaign → ad set → ad; Approve / Reject with note; Mark live; copy buttons; one-table view.

**Phase 4 — Content tracker add-ons (2 days)**
- On each post stage change, create/close the matching task (create → approve → schedule → confirm live → results → boost).
- Boost flag + budget on `SocialPost`; results come from `SocialExternalPost` automatically, manual entry only as fallback.
- "Ideas from results" AI: proposes posts as `idea` drafts on the calendar.

**Phase 5 — SEO blogs (3 days)**
- `SocialBlog`: title, slug, meta description, body, product links, cover image, status (idea → draft → changes → approved → published), monthly target (default 5).
- AI draft with the client's brand kit; owner edits and approves; **Publish** button posts to the Shopify blog (needs `write_content` scope) with the cover image.

**Phase 6 — Website funnel (2–3 days, risk R1)**
- Sessions, add-to-cart, orders; landing pages, sources, devices; stored daily.
- Funnel view + website tasks.

**Phase 7 — Insights, idea box, 15-day reports (3 days)**
- Daily insights job: reads goals, ads, Shopify, change log → writes insights + tasks (via `askAI()`, so it runs on Claude, OpenAI or Gemini).
- Idea box brief + "add these as tasks"; video-idea preset in Ideas.
- Report: 15-day option, e-commerce KPIs, "what was done" from tasks, 30-day plan; reuse PDF + email.

**Phase 8 — Image maker (1–2 days)**
- "Product photo" branded template: 1–3 photos from the media library, sizes 1080×1350 / 1080×1080 / 1080×1920 / 1200×630, 3–4 styles, text pulled from a blog, ad or post.

**Phase 9 — Move Siyara over, tests, ship (2 days)**
- One-time import of the artifact's current data (tasks, creatives, posts, blogs, reports, change log) into Siyara's client.
- Unit tests for ROAS maths, task transitions, Shopify parsing; tenant-isolation tests for the new tables; smoke script; packed standalone build.

**Total: about 23–28 dev days.** Phases 0 → 1 → 2 give a usable desk (real ROAS + tasks) in ~8 days.

---

## 3. Risks

- **R1 Shopify traffic data.** Orders and sales are easy through the Admin API. Sessions, landing pages, sources and devices are analytics data; whether the store's plan and API version expose them (ShopifyQL / reports) must be checked against Siyara's store before phase 6. Fallback: GA4 Data API, or keep the funnel to orders-only data.
- **R2 Meta purchase data.** Purchases and revenue only appear if the pixel/CAPI is set up on the store. Meta revenue includes COD orders later cancelled — show Shopify ROAS as the main number, Meta ROAS as secondary (the artifact already does this).
- **R3 Order with other plans.** The existing-features plan and the paused autopilot plan touch the same areas (approvals, reports, AI). Phase 2 tasks and phase 7 reports should be built so the autopilot can reuse them.
- **R4 AI cost.** Daily insights per client add AI calls; respect the per-client AI budget in `SocialAiSettings`.

---

## 4. Decisions needed before starting

- **D1** Build it for every client (recommended, Siyara as the first) or only for Siyara?
- **D2** Shopify connection: custom-app token pasted per store (recommended for now, works today) or a public Shopify app with OAuth (needs Shopify app review, weeks)?
- **D3** Where it goes in the order: before the existing-features plan, after it, or in between (e.g. after its phase 1)?
- **D4** Import Siyara's current artifact data, or start fresh?
- **D5** Who uses it: agency staff only, or should the client owner also approve ads/blogs/tasks from the client portal?
