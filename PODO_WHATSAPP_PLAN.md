# Podo Social: WhatsApp plan

Written 16 Nov 2026. Updated same day after implementing Phases 1–6 in code (deploy + Meta
App Review + live template wording still need you).

## Where we are today

| Item | Status |
| --- | --- |
| Podosphere's own number (+91 91191 05802) connected in the dashboard | Live |
| Inbox, sending messages, templates, keyword auto-replies, broadcasts | Live |
| "Messages in the last 30 days" card (sent / delivered) | Pushed — run Phase 0 server command if not live yet |
| Lead flow (the six features in Phase 1) | **Built** — migrate + deploy + test still needed |
| Agency → client WhatsApp (report / approval / payment) | **Built** — needs approved templates + per-client switches |
| Chats from ads table | **Built** |
| 1-Click WhatsApp webhook (safe merge) | **Fixed in code** |
| Portal WhatsApp tab | **Built** (shows when a number is linked to that client) |
| Multi-number assign to clients | **Built** (UI on WhatsApp page) |
| Connecting clients' own numbers via Connect (non-admins) | Still blocked until Meta App Review (Phase 4) |
| Read/click template counts (6.1) and lead quality to Meta (6.2) | **Not built** — need your yes (one-way Meta setting) |

## Rules that apply to every phase

- Nothing is sent to a real person until you switch it on or press Send yourself.
- Every phase is deployed on its own, and checked on the live site, before the next one starts.
- Only message people who agreed to be contacted on WhatsApp. Blocks and reports lower the
  number's rating and its daily limit.
- Meta charges for each marketing template. Replies within 24 hours of the customer's own
  message are free.
- A client's customers should get messages from the client's number, not Podosphere's.

---

## Phase 0: Finish the deploy that is waiting

**What:** put the stats card live.

**You do:** on the server, in `/var/www/podo-social`, run `bash scripts/server-pull-restart.sh`.

**Done when:** the WhatsApp page shows "Messages in the last 30 days" with about 13 sent and
13 delivered.

---

## Phase 1: Lead flow (built — deploy and test)

**What it does**

1. Welcome template sent to a new ad-form lead straight away.
2. "Send WhatsApp" on the Leads page, for one lead or many.
3. Two follow-ups if the lead stays silent; they stop when the lead replies or says STOP.
4. WhatsApp chat and status shown on each lead; a lead that replies moves to Contacted.
5. Alert to the sales person's WhatsApp for every new lead.
6. Chats that start from a click-to-WhatsApp ad are tagged with the ad and added as leads.

It also fixes leads arriving without a phone number.

**Steps**

1. `leads_retrieval` permission. Checked 16 Nov: the app has it for the app's own admins
   (standard access), not yet for other users (that needs App Review, Phase 4). The Facebook
   connect did not ask for it, so that is now added in code, with a fallback to the agency
   system token. After the deploy, reconnect the Podosphere Facebook Page once.
2. Create two templates in the WhatsApp page and wait for Meta to approve them:
   - Welcome, for example: "Hi {{1}}, thanks for your interest in Podosphere. Our team will
     call you shortly."
   - Sales alert, for example: "New lead: {{1}}, phone {{2}}, email {{3}}, from {{4}}."
   The blanks are always filled in this order: name, phone, email, ad or form.
3. Deploy. This changes the live database (new columns and tables), so the output of
   the server command must be checked for a migration error.
4. Test with the switch still off: use Meta's Lead Ads Testing Tool to send a test lead and
   confirm it shows on the Leads page with name and phone.
5. Test a manual send to your own number from the Leads page.
6. Switch on "Send WhatsApp messages to new leads automatically" for the Podosphere client
   only. Send one more test lead and confirm the welcome arrives and the sales alert arrives.
7. Add the WhatsApp consent line to Podosphere's lead forms in Ads Manager.

**Done when:** a test lead gets the welcome within a minute, the sales person gets the alert,
a reply moves the lead to Contacted, and a follow-up is seen going out to a lead that did not
reply.

**Risks:** the database step failing on deploy; the permission in step 1 missing; a template
with blanks in a different order sending the wrong words.

---

## Phase 2: WhatsApp for running the agency — **built in code**

Messages from Podosphere's number to Podosphere's own clients. No client number needed, so
nothing here waits for App Review.

| # | Feature | What it does | Needs |
| --- | --- | --- | --- |
| 2.1 | Monthly report on WhatsApp | Sends the client their report PDF with a short summary | Document-header template; client phone + Report switch |
| 2.2 | Approval reminders | Pending client-approval count + portal link | Template (+ optional URL button); Approvals switch |
| 2.3 | Payment reminders | Ops unpaid invoices 3 days before and on due date | Utility template; client linked on Ops + Payments switch |

**UI:** WhatsApp page → "Agency WhatsApp (to your clients)".

**Build notes:** template send now supports DOCUMENT headers and dynamic URL button params.

**Done when:** one real client receives a report, an approval reminder and a payment reminder,
each switched on by hand.

---

## Phase 3: Click-to-WhatsApp ads for Podosphere — **built in code**

**What:** run Podosphere's own ads with a button that opens a WhatsApp chat instead of a form.

**In the product**

1. You create the ad in Ads Manager with Podosphere's number as the destination.
2. "Chats from ads" table on the WhatsApp page: ad name, chats started, replies, leads won.
3. Keyword auto-replies already exist for the first reply.

**Done when:** a chat started from the ad shows the ad name in the inbox and on the Leads page,
and the table counts it.

---

## Phase 4: Meta App Review (unblocks client numbers)

**What:** get the Podo Social app approved so clients can connect their own WhatsApp numbers
through the Connect button. Today that only works for the two app admins.

**Steps**

1. List the permissions to request: WhatsApp messaging and management, plus `leads_retrieval`
   if Phase 1 found it missing.
2. Record the screen videos Meta asks for, showing each permission in use.
3. Submit, answer Meta's questions, fix what they reject.
4. **1-Click Connect fixed:** only updates the `whatsapp_business_account` subscription, merges
   existing fields, refuses non-`/api/webhooks/whatsapp` URLs, does not touch page webhooks.

**Done when:** a test client account that is not an app admin connects its own number.

**Timing:** Meta's review usually takes days to a few weeks, so this starts alongside Phase 2.

---

## Phase 5: WhatsApp services to sell to clients — **partially built**

Starts fully when Phase 4 is approved. First client: Siyara Beauty.

| # | Feature | Status |
| --- | --- | --- |
| 5.1 | Lead follow-up package | Phase 1 per-client flow — ready once their number is connected |
| 5.2 | Broadcast campaigns | Already exists |
| 5.3 | Abandoned cart / order updates | Not built (needs Shopify hooks) |
| 5.4 | Review requests | Not built |
| 5.5 | Client portal WhatsApp view | **Built** — `/portal/whatsapp` |

**Done when:** Siyara's number is connected, their ad leads get the welcome message, and one
broadcast has gone out to their list.

---

## Phase 6: Better reporting and smarter ads

| # | Feature | Status |
| --- | --- | --- |
| 6.1 | Read and click counts for templates | Waiting on your yes (Meta one-way setting) |
| 6.2 | Lead quality back to Meta | Waiting on your yes |
| 6.3 | Other Podosphere numbers | **UI built** — connect each number, assign to a client on the WhatsApp page |

---

## Go-live plan: the best approach

The safest way is to put the code live with every switch off, prove each piece with test
data on your own numbers, and only then switch on one thing at a time. Code going live sends
nothing by itself.

### Step 1. Deploy with everything off (about 15 minutes)

1. Say "deploy". The build is packed, committed and pushed.
2. On the server, in `/var/www/podo-social`, run `bash scripts/server-pull-restart.sh`.
3. Paste the output back. The lines after "db migrate" must show two migrations applied:
   `whatsapp_lead_flow` and `whatsapp_agency_notify`. If they show an error, stop: the Leads
   page will not load until it is fixed.
4. Open the WhatsApp page and the Leads page and check both load.

### Step 2. Create the five templates (10 minutes, then wait for Meta)

Create them on the WhatsApp page. Suggested wording, with the blanks in the order the
dashboard fills them:

| Template | Category | Wording | Blanks |
| --- | --- | --- | --- |
| Welcome | Marketing | "Hi {{1}}, thanks for your interest in Podosphere Technologies. Our team will call you shortly. Reply here if you have any question." | name |
| Sales alert | Utility | "New lead: {{1}}. Phone {{2}}. Email {{3}}. Source: {{4}}." | name, phone, email, ad or form |
| Monthly report | Utility, with a document header | "Hi {{1}}, your monthly report is attached. Leads: {{2}}. Ad spend: {{3}}. Cost per lead: {{4}}." | client, leads, spend, cost per lead |
| Approval reminder | Utility | "Hi {{1}}, {{2}} post(s) are waiting for your approval. Please review them in your portal." | client, number of posts |
| Payment reminder | Utility | "Hi {{1}}, a payment of {{2}} is due on {{3}}. Please ignore this if already paid." | client, amount, due date |

Meta usually approves utility templates within minutes and marketing ones within a day. If
Meta changes a utility template to marketing, it still works but costs more per message.

### Step 3. Test the lead flow with the switch off (20 minutes)

1. Reconnect the Podosphere Facebook Page in Channels, so it gets the lead permission.
2. Send a test lead from Meta's Lead Ads Testing Tool, with your own phone number.
3. Check the lead shows on the Leads page with name and phone. If the phone is missing,
   stop and tell me: nothing else in the lead flow can work without it.
4. Tick that lead, choose the welcome template, press Send WhatsApp. Check it arrives.
5. Reply from your phone. Check the lead moves to Contacted and the chat shows on the lead.

### Step 4. Switch on for Podosphere only

1. On the WhatsApp page, with the Podosphere client selected, set the welcome template, the
   sales person's number and the alert template, tick the switch, Save.
2. Send one more test lead. The welcome and the sales alert should both arrive within a minute.
3. Leave follow-ups empty for the first week. Add them once the welcome is working well.
4. Add this line to Podosphere's lead forms in Ads Manager: "I agree to be contacted on
   WhatsApp about my enquiry."

### Step 5. Agency messages, one client first

1. In "Agency WhatsApp (to your clients)", choose the three templates.
2. Pick one friendly client. Enter their number and switch on Approvals only.
3. After a week with no complaints, switch on Reports, then Payments, then add more clients.
4. Reminders only go out between 10:00 and 19:00 India time, at most one per client per day.

### Step 6. Watch for the first two weeks

- WhatsApp page: the number's quality rating should stay green. If it turns yellow, switch
  the lead flow off and check which template people are blocking.
- Leads page: any lead showing "WhatsApp failed" tells you the reason on the card.
- "Messages in the last 30 days": delivery rate should stay above 90%.

### Step 7. In parallel: App Review

Submit the Podo Social app for review (Phase 4) so clients can connect their own numbers and
their Pages can deliver lead details. Nothing for clients' own leads works until this passes.

### Open choices

1. Approval reminders: **built** — at most one per day (10:00–19:00 IST), stop after 3 for the
   same waiting posts; counter resets when that set of posts changes or clears.
2. Follow-up timing: **defaults already** — first after 24 hours, second after 48 more (editable
   on the lead-flow card).

## Order and what each phase waits for

1. Phase 0: today, one command (if stats card not live).
2. Deploy Phase 1 + 2 + 3 schema/code together (migrations `whatsapp_lead_flow` + `whatsapp_agency_notify`).
3. Phase 4 App Review in parallel.
4. Phase 5 cart/reviews after Phase 4 + Shopify decisions.
5. Phase 6.1 / 6.2 after you decide.

## Decisions I need from you

1. Deploy Phase 1–3 now, yes or no.
2. The wording of the welcome and sales-alert templates, and the sales person's number.
3. Wording for report / approval / payment templates (report needs a **document** header).
4. Phase 6.1 and 6.2: yes or no.
5. Phase 6.3: which client or team +91 91191 27859 and +91 91191 37508 belong to (assign in UI after connect).
