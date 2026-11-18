# Client Portal: WhatsApp and Growth like the admin side (agile plan)

Written 2026-11-18. Status: **Sprints 1–5 done (2026-11-18)** — WhatsApp view/act + Growth view/act + Sprint 5 finish.
Build with `/client-portal`. Follows `PODO_CLIENT_PORTAL_V2_PLAN.md`.
C1: WhatsApp + Growth (`sales`) offer Can act in `portal-tabs.ts`. WhatsApp desk at `/portal/whatsapp`; Growth at `/portal/sales`.

## 1. What was asked

1. The client's WhatsApp tab shows nothing useful. There is no sending and no way to connect the
   client's WhatsApp number.
2. The client's Growth tab should work like the admin Growth Desk.
3. The plan should be hierarchy based (epic → feature → story) and run in agile sprints.

## 2. Where we are today

| Area | Admin side | Client portal today | Gap |
|---|---|---|---|
| WhatsApp | Connect number, inbox, send, templates, broadcasts, auto-replies, lead flow, order flows, ad chats | Overview + chats + templates + broadcasts (agency approval) + automation view; Can act reply/template/broadcast with daily cap | A1.3 Meta Embedded Signup stub only (disabled button until App Review) |
| Growth | 13 tabs: Today, Idea box, Review, Performance, Campaign plan, Content, Blogs, Images, Website, Ideas, Change log, Reports, Setup | Growth desk: Overview, Performance, Website, Content, Reports, Campaign plan, Blogs, Idea box | Skip admin-only: Today, Review, Images, Ideas, Change log, Setup |
| Access levels | — | WhatsApp + Growth support Hidden / View only / Can act | Agency sets level on Clients → Portal control |

Why the Invesbricks WhatsApp page is all zeros: no WhatsApp number is linked to that client
("No WhatsApp number linked to your brand yet"). The tab was switched on by hand, so it shows but
has no data.

**One outside blocker:** a client connecting their own number with the Connect button works only
for the two Meta app admins until Meta App Review passes (`PODO_WHATSAPP_PLAN.md` Phase 4). Until
then the agency connects the number on the admin WhatsApp page and assigns it to the client.
Portal shows a disabled "Connect WhatsApp" button + note (A1.3 stub).

## 3. Access hierarchy

| Level | Who | What they control |
|---|---|---|
| 1 | Agency owner / admin | Everything. Sets each client's tab level on Clients → Portal control. Connects and assigns numbers. Sets sending limits |
| 2 | Agency staff | Works on the clients they are given. Approves client send requests |
| 3 | Client (portal login) | Only their own data. Per tab: **Hidden / View only / Can act** |

New in this plan: WhatsApp and Growth get the **Can act** level. Every write API checks the level
on the server with `requirePortalTab(tab, 'act')`. Hiding a button is not enough.

## 4. Work breakdown (epic → feature → story)

### Epic A — WhatsApp in the client portal

**A1. Connect the client's number**
- [x] A1.1 Agency connects the client's number on the admin WhatsApp page and assigns it to the client.
  No code. Works today.
- [x] A1.2 Portal shows a number card: phone, business name, quality rating, messaging limit tier
  (and daily send cap when Can act).
- [~] A1.3 "Connect WhatsApp" button in the portal — **stub only** (disabled + note). Real Meta
  Embedded Signup waits for Meta App Review.

**A2. Chats (view, then act)**
- [x] A2.1 List conversations of the client's own number, open a chat, read messages.
- [x] A2.2 Reply inside the free 24-hour window. Needs level Can act.
- [x] A2.3 Each reply is saved to the audit log with the approver id.

**A3. Sending**
- [x] A3.1 List approved templates of the client's number (view).
- [x] A3.2 Send one template to one contact (act); daily cap enforced.
- [x] A3.3 Broadcast to a list. Client prepares → agency approves (default
  `whatsappBroadcastNeedsApproval: true`); if flag false, client sends under daily cap.
  Agency: list pending + approve/reject on WhatsApp growth tools.

**A4. Automation (view)**
- [x] A4.1 Auto-reply rules and lead-flow status for the client's number
  (`GET /api/portal/whatsapp/automation`).
- [x] A4.2 Order recovery results with 7 / 30 day switch (`?days=` on overview).

**A5. Numbers**
- [x] A5.1 Sent / delivered / replied for 30 days on the Overview card.

### Epic B — Growth in the client portal, like the admin Growth Desk

Same sub-tabs as admin where they make sense for a client. Admin display components are reused;
data comes from new `portal-growth-*.service.ts` files (never the admin APIs).

| Admin tab | Client portal | Level |
|---|---|---|
| Hero (ROAS vs target, KPIs) | Yes | View. Spend follows "show ad spend" |
| Performance | Yes | View |
| Website | Yes | View |
| Content | Yes | View |
| Reports | Yes | View, download PDF |
| Campaign plan | Yes | Act: approve / reject a proposed campaign |
| Blogs | Yes | Act: approve / ask for changes on a draft |
| Idea box | Yes | Act: send an idea to the agency (no AI call from the client) |
| Today, Review | No | Agency staff work |
| Images, Ideas | No for now | AI cost |
| Change log, Setup | No | Agency only. Holds store tokens |

- B1 View tabs: Hero, Performance, Website, Content, Reports. **Done**
- B2 Act tabs: Campaign plan approval, Blog approval, Idea box. **Done**
- B3 Works without Shopify: shows ads + GA4 only, with a clear "store not connected" note. **Done**

### Epic C — Control and safety

- [x] C1 Add Can act to the `whatsapp` and `sales` tabs in `portal-tabs.ts` and on Portal control.
- [x] C2 Per-client WhatsApp sending limit (`portalTabs.whatsappDailyCap`, default 50) and
  broadcast-approval switch (`whatsappBroadcastNeedsApproval`, default true). Wired in A3.3.
- [x] C3 Isolation tests: WhatsApp paths + Growth (`portal-growth-isolation.test.ts`) + Sprint 5
  broadcast/automation paths.
- [x] C4 Phone-width check of WhatsApp + Growth desks (stack columns, touch tabs, no overflow).

## 5. Sprints

One sprint = one week. Each sprint ends the same way: tests pass → demo with "Open as client" →
your yes → deploy. Nothing is sent to a real person and nothing is deployed without your yes.

| Sprint | Goal | Stories | Done when |
|---|---|---|---|
| 0 (no code) | Real data for one client | A1.1; link Shopify / GA4 for the pilot client; submit Meta App Review | The pilot client's WhatsApp tab shows its number and real counts |
| 1 | WhatsApp view | A1.2, A2.1, A3.1, A5.1, C3 | **Done** — Overview number card, chats, approved templates, 30d stats; isolation tests |
| 2 | WhatsApp act | C1, A2.2, A2.3, A3.2, C2 | **Done** — Can act reply + template send with audit + daily cap; view-only 403 via `requirePortalTab` |
| 3 | Growth view | B1, B3, C3 | **Done** — Client sees Hero, Performance, Website, Content, Reports for own data (`portal-growth-*.service.ts`, `/portal/sales` desk) |
| 4 | Growth act | B2 | **Done** — Campaign approve/reject, blog approve/ask-changes, Idea box create (no AI); `requirePortalTab('sales','act')` |
| 5 | Finish | A3.3, A4.1, A4.2, C4, A1.3 stub | **Done** — Broadcast approval, automation view, 7/30 order recovery, phone polish; A1.3 stub only (no Embedded Signup) |

Backlog (not in a sprint yet): Images and Ideas tabs for clients, client-side AI, billing,
A1.3 real Meta Embedded Signup after App Review.

## 6. Decisions needed (my pick first)

1. **Pilot client** → *Siyara Beauty* (has Shopify and is the first WhatsApp client in the
   WhatsApp plan). Invesbricks has no number or store linked yet.
2. **Client broadcasts** → *Client prepares, agency approves.* Other option: client sends freely
   up to a daily cap.
3. **Who pays Meta's template charges** → *Agency sets a daily cap per client and bills it.*
4. **Order of work** → *WhatsApp first (sprints 1–2), then Growth (3–4).*
5. **Growth tabs a client sees** → *The table in Epic B.* Say if Today / Review should also show.

## 7. Rules (unchanged)

Client and organization only from `getPortalSession()`. Every query filters by both. Small portal
response shapes, no tokens or phone-number ids. Isolation test per service. Works on phone. No
deploy, no prod data, no Meta / WhatsApp writes without an explicit yes.
