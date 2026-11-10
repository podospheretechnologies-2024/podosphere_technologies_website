---
name: client-portal
description: Build or extend the PodoSphere client portal (the client-facing login where each client sees only their own channels, ads, posts, leads, sales and reports). Use when adding a portal tab or feature, changing client login/password, or checking that portal data is isolated per client.
argument-hint: "[feature to add, e.g. 'ads tab' or 'phase 1']"
---

# Client portal builder

The request: $ARGUMENTS

## 1. Load context first
- Read `PODO_CLIENT_PORTAL_PLAN.md` (phases, tab list, rules, ideas, decisions). If the request is a
  phase, build that phase; if it is a new idea, add it to the plan's table/ideas first.
- Read `AGENTS.md`: this is a newer Next.js. Check `node_modules/next/dist/docs/` before writing routes,
  pages, cookies or server actions.
- Existing pieces: `src/app/(approver)/approver/portal/page.tsx`, `src/shared/server/portal-session.ts`
  (`getPortalSession`, cookie `approver_session`), `src/modules/social/server/approvals/approval.service.ts`
  (`createPortalSession`, `verifyPortalSession`, `PortalSession = { approverId, organizationId, customerId }`),
  `ClientApprover` in `prisma/schema/social.prisma`, `/api/approver/*`, `/api/social/clients/[id]/portal-login`.
- Per-client data links: `SocialIntegration.customerId`, `AdAccount.customerId`,
  `SocialGoogleAdsAccount.customerId`, Growth Desk `growth-scope.ts`.

## 2. Plan before code
Write a short plan in chat: files to add/change, DB changes, the portal response shape, and the
isolation test. If a decision in the plan's section 6 is still open and this work depends on it, ask
it (one AskUserQuestion, recommended option first). Otherwise build.

## 3. Hard rules (never skip)
1. Customer and organization come **only** from `getPortalSession()`. Never from URL, query or body.
2. Every Prisma query in portal code filters by `customerId` (directly or through the integration /
   ad account) **and** `organizationId`.
3. Return portal-specific shapes. No access tokens, internal ids of ad accounts, staff notes, other
   clients, cost/margin fields.
4. Read-only unless the plan lists the action (approve/reject, reconnect own channel, request,
   change own password).
5. Respect the per-client tab toggle (`enabled(client)` in the tab registry once Phase 2 exists).
6. Passwords: bcrypt (12 rounds, same as `invitation.service.ts`), generic error on wrong login,
   rate limit, never log or return a hash.
7. Must work at phone width.

## 4. Build
- Services in `src/modules/social/server/portal/` (`portal-<tab>.service.ts`), pages under the portal
  route, APIs under `/api/portal/*` (or existing `/api/approver/*`).
- DB change → new Prisma migration in `prisma/migrations/`; never edit an applied one.
- Add an isolation test next to the service (pattern: `growth-isolation.test.ts`): two clients in one
  org, assert client A never sees client B's rows.

## 5. Check
- `npx tsc --noEmit -p .`, `pnpm lint` on changed files, `pnpm test` for the new tests.
- Update `PODO_CLIENT_PORTAL_PLAN.md`: mark what is done, note anything left.

## 6. Ship (only when the user asks)
Deploy flow: laptop `pnpm build:deploy` → commit + push (only on request, message ends with the
Co-Authored-By line) → server `bash scripts/server-pull-restart.sh` (runs migrations) → hard refresh.
Never build on the server. Never touch prod data or external services (Meta, Google, WhatsApp)
without an explicit yes.
