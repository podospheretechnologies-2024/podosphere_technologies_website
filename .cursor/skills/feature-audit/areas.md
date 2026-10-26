# Scan map

Use this after `SKILL.md` step 1. Paths are from repo root.

## Ads (`/dashboard/social/ads`)

| Layer | Where |
|---|---|
| Page | `src/app/(dashboard)/dashboard/social/ads/page.tsx` |
| UI | `src/modules/social/components/ads/` (`ads-dashboard`, `ads-manager`, `ads-detail-panel`, `google-ads-panel`) |
| Admin sample | `src/modules/admin/components/marketplace-ads-dashboard.tsx` |
| API | `src/app/api/social/ads/**` |
| Hooks | `src/modules/social/hooks/use-ads.ts` |

Check for:

- Campaign / ad set / ad tables vs a real **reporting** tab (charts, breakdowns, saved reports, date compare, export)
- Multi-select on rows: exists for Meta tools; does it drive bulk pause/duplicate/report?
- Google Ads panel: read-only? mapping? spend vs Meta parity?
- MEMBER blocked via `AdminsOnlyNotice`
- Creative helper is draft-only (`F14`)

Known partial: `META_NAV` `reporting` `inApp: false` → Meta site.

## Agent / Claude (`/dashboard/social/ai`)

| Layer | Where |
|---|---|
| Page | `src/app/(dashboard)/dashboard/social/ai/page.tsx` |
| UI | `src/modules/social/components/ai/` |
| Key files | `content-studio.tsx`, `ai-variation-card.tsx`, `ai-image-generator.tsx`, `copilot-panel.tsx` |

Check for:

- Multi-select variations and generated images (seeded **AI-MULTI**)
- Copilot SSE (pending in `SOCIAL_PENDING.md`)
- Brand kit per client
- Provider settings OWNER/ADMIN only

## Clients

| Layer | Where |
|---|---|
| Page | `src/app/(dashboard)/dashboard/social/clients/page.tsx` |
| Onboarding | `.../clients/[id]/onboarding/page.tsx` |
| Switcher / scope | `src/modules/social/components/shell/client-switcher.tsx`, `client-scope-provider.tsx` |
| Server | `src/modules/social/server/customers/`, `src/shared/server/client-scope.ts` |
| Nav | `src/modules/social/config/app-nav.ts` (`clients`) |

Check for:

- List not showing clients, logos, assigned channels/ads
- Create/edit pickers overflowing
- Switcher vs cookie `CLIENT_SCOPE_COOKIE`
- Onboarding + magic link

## Admin (`/admin`)

| Layer | Where |
|---|---|
| Pages | `src/app/(admin)/admin/page.tsx`, `.../marketplaces/page.tsx` |
| Auth | `src/app/(admin-auth)/admin/login/page.tsx`, `(admin)/layout.tsx` |
| UI | `src/modules/admin/components/` |
| Server | `src/modules/admin/server/` |

Check for:

- Only health table + impersonate + marketplace demo
- No feature flags, billing override, ads token ops, user search
- Unauthenticated `/admin` must redirect to login (not 500)

## Overall (every tab)

Walk `socialAppNav` in `src/modules/social/config/app-nav.ts` plus Team (`/dashboard/team`) and Bio (`navigation.ts` has Bio; confirm it is in the live shell).

| Nav key | Page folder | Typical gaps to look for |
|---|---|---|
| overview | `overview/` | All-clients rollup empty / wrong scope |
| calendar | `calendar/` | Recurrence, CSV, approvals |
| ai | `ai/` | See Agent |
| analytics | `analytics/` | Competitors, stories, export |
| media | `media/` | Client library mix, vision |
| automation | `automation/` | RSS / sheets / webhooks |
| channels | `channels/` | refreshNeeded, connect admin-only |
| whatsapp | `whatsapp/` | templates, auto-replies, one-number |
| ads | `ads/` | See Ads |
| settings | `settings/` | signatures, tags, templates |
| clients | `clients/` | See Clients |
| inbox | `inbox/` | reply/hide needs App Review (ops) |
| leads | `leads/` | score, CRM push |
| reports | `reports/` | PDF, schedule, white-label |
| billing | `billing/` | Razorpay env (ops) |
| api | `api/` | public `/api/v1` keys |

Also: `src/app/(dashboard)/dashboard/team/page.tsx`, Bio page if linked in the shell.

## Competitor notes (optional, Agent only)

Public behaviour only, already summarised in:

- `reports/Agency client models in social tools.md`
- `research_notes/Agency client models in social tools/`

Do not scrape competitor apps into our codebase. Use notes to name **missing** agency features (report builder, bulk ads, client portal depth), then map each to our files.
