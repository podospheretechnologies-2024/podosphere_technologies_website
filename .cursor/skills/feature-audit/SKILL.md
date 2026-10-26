---
name: feature-audit
description: >-
  Scan Podo Social for missing, broken, or half-built features across Ads,
  Agent/AI, Clients, Admin, and the rest of the dashboard. Reports a ranked
  backlog only; does not implement. Use when the user types /feature-audit,
  /feature-audit ads, /feature-audit admin, /feature-audit overall, asks what
  features to add, or is in Ask mode and wants a product-gap list.
disable-model-invocation: true
---

# Feature audit (Podo Social)

Read-only product scan. **Do not write, edit, or build** unless the user later says `build <id>` in Agent mode.

Works in **Ask mode** and **Agent mode**. In Ask mode use read/search only (no browser automation required). Never ask the user to switch modes just to produce the report.

## Invoke

```
/feature-audit
/feature-audit ads
/feature-audit admin
/feature-audit overall
/feature-audit ai
/feature-audit clients
```

Area from the rest of the message (default **all**):

| Token | Scope |
|---|---|
| `ads` | Meta + Google Ads tab |
| `admin` | `/admin` platform console |
| `ai` / `agent` / `claude` | Agent page, Content Studio, image gen, copilot |
| `clients` | Clients page, switcher, onboarding |
| `overall` / `all` / empty | Every dashboard tab + admin |

## Rules

1. Audit only. End with how to build later; do not start implementation.
2. Prefer live code over `PODO_SOCIAL.md` / `PODO_SOCIAL_CLIENT_PLAN.md` (those are history). Ship status: `SOCIAL_PENDING.md` + `PENDING_CHANGES.md`.
3. Re-implement in this stack. Do not copy competitor source, assets, or proprietary copy.
4. Ops/Meta/env items stay tagged **ops**, not code features.
5. Cite files with line numbers when a gap is proven in code.

## Workflow

Copy and tick:

```
Feature audit:
- [ ] Parse area
- [ ] Read SOCIAL_PENDING.md + PENDING_CHANGES.md
- [ ] Read scan map in areas.md
- [ ] Inventory pages / nav / APIs / UI for the area
- [ ] Verify seeded gaps against current code
- [ ] Classify each finding
- [ ] Print the report
```

### 1. Inventory

For the chosen area, read [areas.md](areas.md) then search:

- Pages: `src/app/(dashboard)/dashboard/social/**/page.tsx`, `src/app/(admin)/**/page.tsx`
- Nav: `src/modules/social/config/app-nav.ts`
- UI: `src/modules/social/components/<area>/`, `src/modules/admin/components/`
- API: `src/app/api/social/<area>/`, `src/app/api/admin/`
- Schema: `prisma/schema/*.prisma` for related models

Look for: empty/stub UI, `inApp: false` / `window.open` to Meta, single-item actions where bulk is expected, TODOs, “coming soon”, dead nav, pages missing from `socialAppNav`, MEMBER-blocked screens, layout/overflow bugs, missing filters/export/detail.

### 2. Seeded gaps (verify every run)

These were reported by the team. Confirm they still exist before listing them.

| ID | Area | What to verify |
|---|---|---|
| ADS-REPORT | ads | Ads Reporting is external. `META_NAV` `reporting` has `inApp: false` in `ads-manager.tsx`; menu opens Meta Ads Manager. No in-app breakdown report (age/gender/placement/device, custom columns saved, PDF/CSV of the grid). |
| AI-MULTI | ai | Claude/Content Studio + image gen have no multi-select. `AiVariationCard` is one “Use in a post”; `AiImageGenerator` `onUse(item)` is one image. No select-many → composer/library. |
| CLIENTS-UI | clients | Clients list/create/edit: channels, ad accounts, logos, overflow, empty states. Page: `src/app/(dashboard)/dashboard/social/clients/page.tsx`. Switcher: `client-switcher.tsx`. |
| ADMIN-THIN | admin | `/admin` is org list + impersonate + AI cost + sync fails. `/admin/marketplaces` is sample/demo ads. No agency CRUD depth, no per-org feature flags, no ads ops console. |

Drop a seeded row if code already shipped it. Add new rows when inventory finds more.

### 3. Classify

| Tag | Meaning |
|---|---|
| **broken** | UI/data exists but fails (layout, empty, wrong client scope) |
| **partial** | Screen exists; real work is a stub, external link, or read-only |
| **missing** | Competitor/agency table-stakes, not in this repo |
| **ops** | Needs Meta/Google/env/server, not a code feature |

Priority: **P0** broken user-facing · **P1** partial on Ads/AI/Clients/Admin · **P2** missing nice-to-have · **P3** ops.

### 4. Report format

```markdown
## Feature audit — [area]

**Mode:** Ask (report only) | Agent (report only)
**Status date:** [today]

### Snapshot
- Tabs/pages scanned:
- Already solid:
- Biggest holes:

### Backlog
| ID | Pri | Tag | Area | Gap | Evidence | Suggested build (when asked) |
|---|---|---|---|---|---|---|
| ADS-REPORT | P1 | partial | ads | No in-app detailed Ads Reporting | ads-manager.tsx META_NAV reporting inApp:false | In-app report builder from AdInsightDaily + export |

### Do not build from this skill
Type `build ADS-REPORT` in **Agent** mode (optionally `/build-new-feature` then `/coding-controller`).
```

Keep the table to the real gaps (aim ≤ 15). No essay. No competitor pixel-clone plan.

## Ask vs Agent

| | Ask | Agent |
|---|---|---|
| Tools | Read, grep, glob | Same; Browser optional for our running app or public marketing pages |
| Output | The report | The same report |
| Code | Never | Never, unless user then says `build <id>` **in a follow-up**, not inside this skill run |

If they say `build` in the same message as `/feature-audit`, still print the audit first, then implement **only the named IDs**.
