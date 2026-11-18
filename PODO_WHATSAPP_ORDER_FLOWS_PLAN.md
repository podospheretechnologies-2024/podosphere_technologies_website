# Podo Social: WhatsApp order flows (the screens)

Written 17 Nov 2026. Status: plan only, nothing built.

This is the WhatsApp side of the Shopify order messages: what the screens look like and how
they are built. The Shopify connection is in `PODO_SHOPIFY_APP_PLAN.md`. The wider WhatsApp
roadmap is in `PODO_WHATSAPP_PLAN.md` (this is Phase 7 there).

## The idea

Everything is set up by clicking, with no code and no settings files, the same way Interakt
works. Interakt gives a store one list of ready-made notifications (order placed prepaid,
order placed COD, order shipped, order cancelled, checkout abandoned); each one has a switch,
a template and an optional delay. We build the same, per client.

Where it lives: WhatsApp page → new tab **Order flows**. It shows only for a client that has
a Shopify store connected.

## Screen 1: the list of flows

One row per flow. A flow is off until you switch it on.

```
 Order flows · Siyara Beauty                     Store: connected ●   Number: +91 ...
 ┌────────────────────────────────────────────────────────────────────────────────┐
 │ ORDER UPDATES                                          Sent 30d   Delivered    │
 │ ( on) Order confirmed (prepaid)   order_confirmed_v1      412       98%  Edit  │
 │ ( on) Order confirmed (COD)       cod_confirm_v1          190       97%  Edit  │
 │ (off) Payment received            choose a template        -         -   Edit  │
 │ ( on) Order shipped               order_shipped_v2        377       99%  Edit  │
 │ (off) Order cancelled             choose a template        -         -   Edit  │
 │ (off) Refund done                 choose a template        -         -   Edit  │
 ├────────────────────────────────────────────────────────────────────────────────┤
 │ RECOVER SALES                                  Sent 30d   Recovered   Revenue  │
 │ ( on) Abandoned checkout 1  after 45 min         230         31       ₹46,500  │
 │ (off) Abandoned checkout 2  after 24 hours        -           -          -     │
 │ (off) Review request        5 days after delivery -           -          -     │
 └────────────────────────────────────────────────────────────────────────────────┘
```

Rules on this screen:

- A switch cannot be turned on until an approved template is chosen.
- A warning banner shows if the store is not connected, the number is not connected, or
  Shopify stopped sending events.

## Screen 2: editing one flow

Opens when you press Edit. Left side is the settings, right side is a phone preview that
updates as you choose.

```
 Abandoned checkout 1                                              [ Save ]  [ Cancel ]
 ┌──────────────────────────────────────────┐   ┌──────────────────────────┐
 │ 1. When                                  │   │  Siyara Beauty        ✓  │
 │    A customer leaves the checkout        │   │ ┌──────────────────────┐ │
 │                                          │   │ │ Hi Priya, you left   │ │
 │ 2. Wait                                  │   │ │ 2 items in your cart │ │
 │    [ 45 ] [ minutes ▾ ]                  │   │ │ worth ₹1,499.        │ │
 │                                          │   │ │                      │ │
 │ 3. Only if (optional)                    │   │ │ [ Complete order ]   │ │
 │    Cart value at least  [ ₹ 500 ]        │   │ └──────────────────────┘ │
 │    Payment type         [ Any ▾ ]        │   └──────────────────────────┘
 │                                          │
 │ 4. Send this template                    │    [ Send a test to my number ]
 │    [ cart_reminder_v1 (English) ▾ ]      │
 │                                          │
 │ 5. Fill the blanks                       │
 │    {{1}}  [ Customer first name ▾ ]      │
 │    {{2}}  [ Number of items     ▾ ]      │
 │    {{3}}  [ Cart total          ▾ ]      │
 │    Button link  [ Checkout link ▾ ]      │
 │                                          │
 │ 6. Stop if                               │
 │    ☑ the order gets placed               │
 │    ☑ the customer replies STOP           │
 └──────────────────────────────────────────┘
```

Choices available for the blanks: customer first name, full name, order number, order total,
number of items, first product name, payment type, tracking link, courier name, checkout
link, order status link, discount code, store name.

"Send a test to my number" sends the template with sample data to a number you type, so each
flow can be checked before it is switched on.

## Screen 3: activity

A table of every message, newest first, with filters for flow, status and date.

| Time | Customer | Flow | Order / cart | Status | Result |
| --- | --- | --- | --- | --- | --- |
| 17 Nov 14:02 | Priya S. | Abandoned checkout 1 | Cart ₹1,499 | Read | Ordered ₹1,499 |
| 17 Nov 13:40 | Rahul M. | Order shipped | #1042 | Delivered | - |
| 17 Nov 13:12 | Neha K. | Order confirmed (COD) | #1041 | Failed | Number not on WhatsApp |

Status is one of: waiting, sent, delivered, read, failed, cancelled (order placed first),
skipped (no phone, no consent, or said STOP). A failed or skipped row always shows why.

## Screen 4: results

Four numbers for the chosen dates, then a table by flow:

- Messages sent
- Carts recovered
- Revenue recovered
- Money spent on messages (estimate)

A cart counts as recovered when the same customer orders within 7 days of a reminder.

The same four numbers show on the client's portal WhatsApp tab, read-only.

## What gets built

| # | Piece | What it is |
| --- | --- | --- |
| 1 | Database | Flow settings per store; Shopify events received; messages due and sent |
| 2 | Receiving address | `/api/webhooks/shopify`: checks Shopify's signature, saves the event, ignores repeats |
| 3 | Timer | Runs every 5 minutes, sends what is due, cancels cart reminders when the order is placed |
| 4 | Sender | Uses the template sending that already exists, including link buttons |
| 5 | Screens 1–4 | The four screens above |
| 6 | Starter templates | Suggested wording for each flow, ready to submit to Meta from the WhatsApp page |

## Safety rules built in

- Every flow is off by default, per client.
- One message per event, even if Shopify sends the event twice.
- At most two cart reminders per cart, and none after the order is placed.
- No marketing message to anyone who replied STOP, or who did not tick consent at checkout.
- Marketing messages (cart reminders, reviews) only between 10:00 and 21:00 India time. Order
  updates go at any hour.
- If a store produces 20 failed sends in a row, its flows pause and the screen shows a warning.

## Build order

Each step is tested on Podosphere's number with a test store before the next one starts.

1. Database, receiving address, Screen 1 and Screen 2, with **Order confirmed** only.
2. Order shipped, order cancelled, refund done, payment received.
3. Abandoned checkout 1 and 2, with the timer and the cancel-on-order rule.
4. COD confirmation, including reading the customer's YES or NO reply and tagging the order.
5. Screen 3 (activity) and Screen 4 (results), then the portal numbers.
6. Review request.

## Done when

- A test order in the test store sends the confirmation to a test phone within a minute.
- An abandoned test checkout sends reminder 1 after the set delay.
- Placing the order before the delay ends sends no reminder.
- Activity shows each of those with the right status, and Results counts the recovered cart.

## What this waits for

- The Shopify connection in `PODO_SHOPIFY_APP_PLAN.md`, Option 1.
- Sending from a client's own number needs Meta App Review (Phase 4 of the WhatsApp plan).
  Until then only Podosphere's number and a test store can be used.
- Approved templates on each client's number.
- A WhatsApp consent tick box on each client's checkout.

## Not in this plan

- A drag-and-drop flow builder with branches. The fixed list above covers what Interakt's
  Shopify notifications do; a free-form builder can come later if a client needs it.
- Reorder reminders, welcome messages and back-in-stock alerts (flows 11–13 in the main plan).
- WooCommerce or other store platforms.

## Decisions needed

1. Default delays: 45 minutes and 24 hours for cart reminders, 5 days for reviews. OK?
2. Should reminder 2 carry a discount code, and who creates the code: the client in Shopify,
   or the dashboard?
3. Which client goes first once Meta approves the app. The main plan says Siyara Beauty.
