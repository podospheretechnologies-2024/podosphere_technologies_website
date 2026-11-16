# Podo Social: website changes (16 Nov 2026)

> Scope: the public marketing site, meaning `src/app/(marketing)/*` and `src/modules/marketing/*`.
> Goal: the site should show **every feature that is already built**, plus the **public API**.
> Source of truth for "built": `SOCIAL_PENDING.md`, `PODO_GROWTH_DESK_PLAN.md`, `PODO_CLIENT_PORTAL_PLAN.md`, `src/modules/social/config/plans.ts`, `src/app/api/v1/**`.
> Reel # = saved-reels list (Instagram reference). Read `AGENTS.md` before coding (Next.js 16).

---

## 0. Problems on the current site

| # | Problem | Where |
|---|---|---|
| 0.1 | Generic "AI-made" look: purple radial glows (`rgba(97,43,211…)`, `rgba(216,45,126…)`), gradient text on headlines, Sparkles logo | `(marketing)/page.tsx`, `layout.tsx`, `hero-scene-lazy.tsx` |
| 0.2 | Only **6 features** are shown, but **40+ are built**. Missing: WhatsApp, Growth Desk, client portal, GA4/Shopify, Google Ads, link-in-bio, short links, CSV bulk, evergreen posts, festival calendar, white-label, API and more | `features[]` in `page.tsx` |
| 0.3 | Platforms list is wrong: it says FB/IG/LinkedIn/YouTube/GBP, but **Threads + Pinterest** are also live | feature 1 copy |
| 0.4 | No pricing, although 4 plans exist in `plans.ts` | — |
| 0.5 | API docs page is 4 bullet lines with no request/response examples, scopes table, errors or limits | `(marketing)/docs/api/page.tsx` |
| 0.6 | No FAQ, no WhatsApp contact, no social proof, no screenshots of the real product | — |
| 0.7 | Single page, so there is almost nothing for SEO to index | — |
| 0.8 | Nav has only Features / Podo AI / Login. No Pricing, API or Portal links | `layout.tsx` |

---

## 1. Design clean-up (do first)

- [ ] Run **unslop** (reel #1) on `(marketing)`: remove radial glows, gradient headline text and the shadow-glow CTA (`shadow-primary/30`).
- [ ] Make a `design.md` from 2–3 reference SaaS sites (Buffer, Later, Linear) (reel #2) and keep it as `docs/design.md`.
- [ ] Colour 60-30-10 (reel #40): 60% neutral background, 30% surface/ink, 10% brand primary (CTA + key numbers only).
- [ ] Replace the Sparkles icon with a real Podo wordmark.
- [ ] Hero 3D (`HeroSceneLazy`): give mobile its own composition. Below `md`, show a static product screenshot instead of the shrunk 3D scene (reel #9).
- [ ] Keep the `Reveal`/`Stagger` motion. Add smooth scroll only if it doesn't hurt Core Web Vitals.

---

## 2. New page structure

### 2.1 Navigation (`layout.tsx`)
`Product ▾ (Publish · Engage · Grow · Ads · Reports · Client portal)` · `WhatsApp` · `Pricing` · `API` · `Log in` · **`Start free`**
Footer: add Product links, API docs, Pricing, Client login (`/login` → client tab), WhatsApp (`legal.whatsappLink`), plus the existing legal links.

### 2.2 Home (`/`) sections, in order

1. **Hero**: headline without gradient text. Sub-line: "Plan, publish, reply, track ads and report for every client, from one place. Made for Indian agencies." CTAs: Start free · Book a WhatsApp demo. Platform logo strip: Facebook, Instagram, Threads, LinkedIn, YouTube, Pinterest, Google Business Profile, WhatsApp.
2. **Proof strip**: client logos/results. **Only with each client's written OK**; skip until then.
3. **Feature pillars** (6 cards, each links to its page in §3): Publish · Podo AI · Inbox & WhatsApp · Leads · Ads & Growth · Reports & Client portal.
4. **"Made for India" band** (this is our edge over Buffer/Hootsuite): WhatsApp inbox + broadcasts + keyword auto-replies · India festival calendar · ₹ pricing via Razorpay · GST invoices (CGST/SGST split) · Hindi/Hinglish captions (only if AI copy supports it; check first).
5. **Podo AI / approval queue**: keep the current mock card, and add a 20–30 sec product demo video (reels #35, #36).
6. **Agency section**: client workspaces, per-client brand kit, roles (Owner/Admin/Member), client portal, white-label + custom domain.
7. **API teaser**: a code block (see §4) and a link to `/docs/api`.
8. **Pricing preview**: 4 plan cards (see §5) and a link to `/pricing`.
9. **FAQ** (8–10 Qs, see §6).
10. **Final CTA**: Start free + WhatsApp.

---

## 3. Feature pages (new routes under `(marketing)`), covering every built feature

Each page: H1 with keyword · 3–5 feature blocks with real screenshots · "How it works" · FAQ · CTA. Add `metadata` + OG image per page.

| Route | Features to show (all ✅ built) |
|---|---|
| `/features/publish` | Composer for FB, IG, Threads, LinkedIn, YouTube, Pinterest, GBP · calendar + drafts + schedule · tags, signatures, sets · **first comment after publish** · **repeat / evergreen posts** · **CSV bulk schedule** · best time to post · media library with AI alt text + auto-resize · branded image templates |
| `/features/ai` | Podo AI posts / from URL / threads · image presets per platform size · caption tone presets · per-client brand kit · weekly content plan · **Copilot agent** (multi-turn, takes actions after approval) · AI usage per client |
| `/features/inbox` | Unified inbox: FB/IG comments + DMs · reply / hide · AI triage + draft reply · saved replies · assign + SLA |
| `/features/whatsapp` | WhatsApp inbox · templates · broadcasts (cost estimate per message) · keyword auto-replies |
| `/features/leads` | Meta + LinkedIn lead forms in · AI lead score 0–100 with reasons · pipeline · push to **PodoCRM** |
| `/features/ads` | Meta Ads: campaigns, ad sets, ads sync, spend/CTR/fatigue watch, suggestions wait for approval · creative helper (draft-only) · **Google Ads** (read-only: spend, campaigns, ad groups, ads, MCC) |
| `/features/growth-desk` | Per-client Growth Desk: Today, idea box, review, performance, campaign plan, content, blogs (+ publish to Shopify), images, website, change log, reports · **Shopify** orders/revenue/ROAS · **GA4** sessions/users · Meta purchases & revenue · daily AI insights |
| `/features/analytics` | Per-channel growth, reach, impressions, profile views, clicks · stories · 90-day backfill · **competitor recent posts + AI summary** |
| `/features/reports` | Weekly/monthly PDF reports · AI-written narrative (wins, losses, next steps) · auto email via Resend |
| `/features/client-portal` | Client login (email+password or magic link) · tabs: Overview, Content (approve / ask changes), Analytics, Ads, Leads, Sales, Reports, Channels, Requests · agency chooses which tabs each client sees · each client sees only their own data |
| `/features/agency` | Client workspaces + switcher · onboarding · client templates · roles & permissions · **white-label + custom domain** · notifications centre |
| `/features/automation` | RSS → posts · Google Sheets → content calendar · webhooks (with test) · autoposts |
| `/features/link-in-bio` | Bio pages (`/b/[slug]`) · UTM short links (`/l/[code]`) with click tracking |

> Before writing copy, check each item once in the app. Anything waiting on Meta App Review (e.g. DM reply scopes) gets a small "rolling out" tag instead of being hidden.

### SEO pages (reel #20: topical authority + fan-out queries)
- [ ] `/for/agencies`, `/for/d2c-brands`, `/for/coaching-institutes`, `/for/local-business`
- [ ] Comparisons: `/compare/buffer`, `/compare/hootsuite`, `/compare/later` (honest tables, no made-up claims)
- [ ] `/blog` later, using Growth Desk blog drafts for our own site
- [ ] `sitemap.ts` (only `robots.ts` exists now), JSON-LD `SoftwareApplication` + `FAQPage`, canonical URLs, an OG image per page
- [ ] List Podo Social on G2, Capterra, Product Hunt, Crunchbase, SaaSworthy (reel #21)

---

## 4. API docs: rebuild `/docs/api`

The current page has 4 lines. Replace it with a proper docs page using the facts below (taken from `api-client.service.ts` and `src/app/api/v1/**`).

### 4.1 Overview
- Base URL: `https://social.podospheretechnologies.com/api/v1`
- Auth: `Authorization: Bearer ps_live_…` (create a key in **Dashboard → Social → API**; it is shown once)
- A key belongs to one organization and can be limited to **one client**
- Per-key settings: **permissions**, **IP allowlist**, **daily request limit**
- Every call is logged (path + status). `lastUsedAt` is shown in the dashboard
- API is part of the **Agency Pro** plan (`plans.ts` → `api` feature)

### 4.2 Permissions table
| Permission | Endpoint |
|---|---|
| `posts:write` | `POST /posts` |
| `analytics:read` | `GET /analytics` |
| `leads:read` | `GET /leads` |
| `whatsapp:send` | `POST /whatsapp/send` |

### 4.3 Endpoints (one block each: description, body table, curl, sample response)

**POST /posts**: creates a draft, or schedules it if `publishAt` is given.
| Field | Type | Required | Notes |
|---|---|---|---|
| `integrationId` | string | yes | channel id from dashboard → Channels |
| `content` | string | yes | 1–10,000 chars |
| `publishAt` | ISO date string | no | omitted = draft |
```bash
curl -X POST https://social.podospheretechnologies.com/api/v1/posts \
  -H "Authorization: Bearer ps_live_xxx" -H "Content-Type: application/json" \
  -d '{"integrationId":"int_123","content":"Diwali sale is live 🪔","publishAt":"2026-11-20T13:30:00.000Z"}'
```
Returns `201` with the created post group.

**GET /analytics**: post counts for the last 30 days.
**GET /leads**: leads list (same data as the Leads page, scoped to the key).
**POST /whatsapp/send**: sends a WhatsApp message; the body matches the dashboard send API. *(Copy the exact fields from the dashboard send schema into the docs table.)*

> Fill the sample JSON responses by calling each endpoint once on staging. Do not invent fields.

### 4.4 Errors & limits
| Code | Meaning |
|---|---|
| 401 | Missing API key / key invalid or revoked |
| 403 | Key lacks the permission, or IP not in allowlist |
| 429 | Daily API limit reached (resets at UTC midnight) |
| 4xx | Validation error (zod), message says which field |

### 4.5 Also document
- **Outgoing webhooks** (dashboard → Automation): events, payload, test button
- **Short links** `/l/[code]` and **bio pages** `/b/[slug]` as public URLs
- Code samples in curl, Node (fetch) and Python (requests), with a copy button
- Left sidebar nav: Overview · Auth · Permissions · Endpoints · Webhooks · Errors · Changelog

---

## 5. Pricing page (`/pricing`), from `plans.ts`

| | Solo | Agency Starter | Agency Growth | Agency Pro |
|---|---|---|---|---|
| Price / month | ₹1,499 | ₹4,999 | ₹9,999 | ₹19,999 |
| Clients | 3 | 10 | 25 | 60 |
| Users | 2 | 5 | 15 | Unlimited |
| Channels | 6 | 20 | 50 | 150 |
| Scheduling, AI, analytics, WhatsApp | ✓ | ✓ | ✓ | ✓ |
| Approvals, reports, inbox, broadcasts, leads | — | ✓ | ✓ | ✓ |
| Ads (Meta + Google) | — | — | ✓ | ✓ |
| Public API | — | — | — | ✓ |

- [ ] Show prices **+ 18% GST** clearly; mention GST invoice
- [ ] Note that WhatsApp template messages are billed separately at Meta's rate (≈ ₹0.80/msg estimate in code)
- [ ] Monthly/annual toggle only once annual plans exist in Razorpay
- [ ] Confirm final prices before going live (`SOCIAL_PENDING.md` §3 still lists "Pricing / packaging")
- [ ] Read prices from `PLANS` in code, so the site and billing never drift

---

## 6. FAQ (home + pricing)

1. Which platforms are supported? (list all 8, including WhatsApp)
2. Does anything go live without my approval? (No: approval queue for posts, replies and ad changes)
3. Can my clients log in? (Yes: client portal, they see only their own data)
4. Is my clients' data separate? (Yes: per-client scope)
5. Do you support WhatsApp broadcasts? What does it cost?
6. Can I use my own domain / brand? (White-label + custom domain)
7. Do you have an API? (Yes, Agency Pro)
8. Which AI do you use? (Claude by Anthropic)
9. Do you give GST invoices? (Yes)
10. How do I get support? (WhatsApp + email, Mon–Sat 10–7 IST, from `legal.ts`)

---

## 7. Product features to market later (reel ideas, not built yet; don't claim them on the site)

| Idea | Reel # |
|---|---|
| Copilot streaming (SSE), CopilotKit style | #49 |
| Competitor hook analysis (hooks/CTA from competitor reels) | #22 |
| Stale-lead alert (red card + WhatsApp auto follow-up) | #51 |
| 1 video → 5 posts repurpose; YouTube → Shorts | #48, #50 |
| Reel script generator (hook + voiceover + scenes) | #24 |
| X / TikTok providers | — |

---

## 8. Build order

1. §1 design clean-up + nav/footer
2. Home sections (§2.2), with features copy fixed (Threads + Pinterest)
3. `/pricing` (§5) + FAQ (§6)
4. `/docs/api` rebuild (§4)
5. Feature pages (§3), one at a time, with real screenshots
6. SEO: sitemap, JSON-LD, OG images, `/for/*`, `/compare/*`
7. Directory listings (G2, Capterra, Product Hunt)
8. Then `pnpm typecheck && pnpm lint && pnpm build`, run Lighthouse on mobile, and use Agentation (reel #5) for UI fixes

## 9. Checks before shipping
- [ ] Every feature claim matches the app (click through it once)
- [ ] No client logo or result without written permission
- [ ] Prices match `plans.ts` and Razorpay
- [ ] Mobile hero shows no shrunk 3D scene; LCP < 2.5s
- [ ] Legal pages (privacy/terms/data-deletion) are still reachable; Meta App Review depends on them
