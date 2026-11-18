# Podo Social: matching Interakt, feature by feature

Written 17 Nov 2026. Status: plan only, nothing built.

This file records how Interakt works, taken from Interakt's own help pages, pricing page and
Shopify App Store listing, and what Podo Social needs so it can do the same jobs. The screens
are in `PODO_WHATSAPP_ORDER_FLOWS_PLAN.md`; the Shopify connection is in
`PODO_SHOPIFY_APP_PLAN.md`.

**What "same as Interakt" means here:** the same features and the same way of working. The
look, the name, the logos and the wording stay Podo Social's own. Copying their screens or
text exactly would be copying their design, and is not needed to do the same job.

**How sure this is:** Interakt's help pages show most settings as pictures, which could not
be read. Anything marked "(not confirmed)" must be checked by opening Interakt's free trial
and looking at the screen.

---

## 1. How Interakt works for a Shopify store

### The model: one "ongoing campaign" per event

Interakt has no separate order-flow screen. Each automatic message is an **ongoing campaign**
in its Notifications section. A store creates one campaign per event:

| Interakt event | When Shopify raises it |
| --- | --- |
| Order placed | A prepaid order (card, UPI, net banking) |
| Order COD | A cash-on-delivery order |
| Order shipped | The order is marked fulfilled in Shopify |
| Order out for delivery | The courier status changes (ready-made sample campaign) |
| Order cancelled | The order is cancelled, in Shopify or from the COD link |
| Abandoned checkout | The customer stays on the payment page about 15 minutes without paying (not confirmed) |

COD and prepaid are two different events, not a filter on one event. Shopify events arrive in
Interakt by themselves once the Interakt app is installed on the store.

### Creating an ongoing campaign: four steps

1. **What should be sent:** choose an approved template, fill each blank, set a fallback
   for each blank, set the link for the button, Save.
2. **When should it be sent:** one of three triggers:
   - after a customer does an event (the Shopify events above);
   - after a customer detail changes (for example total orders);
   - a few minutes, hours or days after a date saved on the customer.
   Extra filters can be added, joined with AND / OR.
3. **What happens when the customer replies** (optional): opt-out on a button or on a typed
   word such as STOP; send products; send a list of questions; send a fixed reply; start a
   workflow.
4. **Schedule and set live:** start now or on a date; stop never or on a date; Set Live.

### What can fill a blank

Each blank is set to one of four things: a contact field (name), a fixed text, a value from
the event, or a fallback used when the value is empty (for example "there" in place of a
missing name).

Values Interakt offers from Shopify events:

| Event | Values |
| --- | --- |
| Order placed / COD | Order number, order link, order date, order time, payment mode, total amount, discount code, item count; COD also has a COD confirmation link |
| Order shipped | The same, plus tracking link |
| Order cancelled | The same, plus cancellation date |
| Abandoned checkout | Customer email, date, time, total amount (cart value), discount code, item count, abandoned checkout link |

Links can go in the message text or on the template's button. Interakt passes them through
its own redirect link so it can count clicks (not confirmed).

### Numbers Interakt shows for each campaign

| Number | Meaning |
| --- | --- |
| Attempted | Messages it tried to send |
| Sent | Accepted by WhatsApp |
| Delivered | Reached the phone |
| Read | Opened |
| Replied | Customer replied within 72 hours |
| Limited by Meta | Not sent because Meta limits marketing messages per person |
| Other failures | No WhatsApp on that number, daily limit hit, template problem, technical error |
| Button clicks | Per button: unique clicks, and clicks as a share of attempted |

Each number opens the list of customers behind it. Reports can be emailed for up to 31 days:
a summary report, a per-customer report, and a click-to-WhatsApp ads report (lead name,
mobile, date, campaign, ad name, ad ID).

---

## 2. Interakt's full feature list, against Podo Social

"Have" means it exists in Podo Social today. "Partly" rows need a check of the current code
before building, to see exactly what is missing.

### Shopify

| Interakt feature | Podo Social | Plan |
| --- | --- | --- |
| Order placed, shipped, cancelled messages | Not built | Order flows plan, steps 1–2 |
| Out for delivery message | Not built | Order flows plan, step 2 |
| COD confirmation (customer confirms or cancels) | Not built | Order flows plan, step 4 |
| COD to prepaid (offer to pay now) | Not built | New, after COD confirmation |
| Abandoned checkout reminder, single | Not built | Order flows plan, step 3 |
| Abandoned checkout reminders, several | Not built | Order flows plan, step 3 |
| Win-back messages | Not built | Later |
| Shopify contacts copied in automatically | Not built | New, section 3 item 2 |
| Shopify catalogue copied in automatically | Not built | Later (needed only for selling inside WhatsApp) |
| Pop-up on the store to collect WhatsApp numbers | Not built | Later |

### Campaigns

| Interakt feature | Podo Social | Plan |
| --- | --- | --- |
| One-time campaign | Have (Broadcasts) | - |
| Ongoing campaign (event-triggered) | Partly (lead flow only) | Section 3 item 1 |
| Audience by CSV, typed numbers, list, or filters | Partly | Check, then section 3 item 3 |
| Tags, contact fields, events on each contact | Partly | Section 3 item 2 |
| Blanks filled from contact, event, fixed text, fallback | Partly (fixed order for leads) | Section 3 item 1 |
| Delay before sending | Partly (lead follow-ups) | Section 3 item 1 |
| Reply actions: opt-out, fixed reply | Partly (STOP and keyword replies exist) | Section 3 item 4 |
| Reply actions: send products, question list, workflow | Not built | Later |
| Attempted / sent / delivered / read / replied | Partly (sent and delivered) | Section 3 item 5 |
| Button click counts | Not built | Section 3 item 5 |
| Automatic retries | Not built | Later |
| Emailed reports | Not built | Section 3 item 5 (as a download) |
| Template buttons, forms, carousel, limited-time offer | Partly (link buttons, document header) | Later |

### Inbox and support

| Interakt feature | Podo Social | Plan |
| --- | --- | --- |
| Shared team inbox | Have | - |
| Welcome, out-of-office, delayed auto replies | Partly (keyword replies) | Later |
| Assign chats to team members, automatically or by hand | Not checked | Check first |
| Agent and conversation numbers | Not built | Later |
| Chatbot builder, simple and branching | Not built | Later, a large piece |
| AI answer bot / AI agents | Not built | Later |
| WhatsApp chat button for the website | Not built | Small, can come early |
| Roles and permissions | Have (dashboard roles) | - |

### Ads, selling and connections

| Interakt feature | Podo Social | Plan |
| --- | --- | --- |
| Click-to-WhatsApp ads: chats tagged by ad | Have (built, not live) | WhatsApp plan Phase 3 |
| Send conversion data back to Meta | Not built | WhatsApp plan Phase 6.2, needs your yes |
| WhatsApp catalogue, checkout bot, order panel | Not built | Later |
| WhatsApp Pay and payment links | Not built | Later |
| Open connection for other tools (send, track, status) | Not built | Later |
| Instagram auto-replies and giveaways | Outside this plan | - |
| Calling from the inbox | Not built | Not planned |

### Extra things Podo Social has that Interakt does not

Agency messages to your own clients (report, approval, payment reminders), a portal where
each client sees their own WhatsApp results, and lead forms from Meta ads feeding the same
inbox.

---

## 3. What to build to work the same way

The order-flows plan had a fixed list of flows. To work like Interakt, the engine underneath
becomes general: any event can trigger any template. The fixed list stays as ready-made
starting points, the same way Interakt offers sample campaigns.

| # | Piece | What it does |
| --- | --- | --- |
| 1 | Automatic campaigns | The four-step setup from section 1: what to send, when, on reply, schedule. Replaces the fixed flow list; the Order flows screen becomes a list of these campaigns with ready-made samples |
| 2 | Contacts with fields, tags and events | Every Shopify customer and every lead becomes a contact with details (city, total orders), tags, and a history of events. Needed for filters and for filling blanks |
| 3 | Audience filters | Choose who gets a campaign by tag, field or event, with AND / OR |
| 4 | Reply actions | On a button or a typed word: opt out, send a fixed reply |
| 5 | Campaign numbers | Attempted, sent, delivered, read, replied, failed with reason, button clicks, recovered orders; a download of the per-customer list |
| 6 | Click counting | Links go through a Podo Social redirect so button clicks can be counted |

### Build order

1. Shopify connection, Option 1 (`PODO_SHOPIFY_APP_PLAN.md`), on a test store.
2. Items 1 and 2 above with the two order events: order placed and order COD.
3. Order shipped, out for delivery, order cancelled.
4. Abandoned checkout with delay, and the stop-when-ordered rule.
5. Items 5 and 6: campaign numbers and click counting.
6. COD confirmation link, then COD to prepaid.
7. Items 3 and 4: audience filters and reply actions.
8. Website chat button, then the "Later" rows, chosen by what clients ask for.

Steps 1–5 give what Interakt's Shopify Starter plan sells. Steps 6–7 reach its Growth plan.

## 4. What still has to be checked on Interakt itself

Open Interakt's free trial and note these, since the help pages only show them as pictures:

1. The exact delay choices on an ongoing campaign (units and limits).
2. The full list of filter choices (is, is not, greater than, has any value, and others).
3. How the COD confirmation page looks and what the customer can press.
4. Whether abandoned checkout really waits 15 minutes, and whether that can be changed.
5. The sample wording of each ready-made template.

## 5. Decisions needed

1. Confirm the approach: same features and way of working, Podo Social's own look.
2. Build to Interakt's Starter level first (steps 1–5), then decide on the rest. Yes or no.
3. Do you have an Interakt account or trial? If yes, screenshots of the five items in
   section 4 would settle them.

## Sources

- https://www.interakt.shop/resource-center/whatsapp-api-integration-with-shopify/
- https://www.interakt.shop/resource-center/automated-out-for-delivery-notifications-for-shopify-merchants/
- https://www.interakt.shop/integrations/integrating-whatsapp-business-api-with-shopify/
- https://www.interakt.shop/resource-center/whatsapp-message-notification-template-ongoing-campaign-creation/
- https://www.interakt.shop/resource-center/whatsapp-message-notification-template-one-time-campaign-creation/
- https://www.interakt.shop/resource-center/whatsapp-message-notification-template-campaign-performance-statistics/
- https://www.interakt.shop/resource-center/custom-campaign-reports/
- https://www.interakt.shop/resource-center/interakt-apis-and-webhooks-an-overview/
- https://www.interakt.shop/resource-center/sending-whatsapp-marketing-campaigns-with-checkout-buttons/
- https://www.interakt.shop/pricing-us/
- https://apps.shopify.com/interakt-marketing
