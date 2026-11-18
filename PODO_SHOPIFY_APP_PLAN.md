# Podo Social: Shopify app plan

Written 17 Nov 2026. Status: plan only, nothing built.

This is how each client's Shopify store gets connected so the dashboard can receive orders,
shipping updates and abandoned checkouts. The WhatsApp screens that use this are in
`PODO_WHATSAPP_ORDER_FLOWS_PLAN.md`.

Order: **Option 1 first** (one app per client store), tested on one store, then rolled out to
the 5 clients. **Option 2 after** (one Podosphere app for every store), once Option 1 is
proven.

## What was checked on Shopify's developer site (17 Nov 2026)

- Custom apps can no longer be created inside the Shopify admin. New ones are made in
  Shopify's **Dev Dashboard**. Old ones keep working.
- The simple login (client ID + secret) works only when the app and the store are in the
  same Shopify organisation. Its tokens last 24 hours and are renewed automatically.
- Access needed:

| Access | Used for |
| --- | --- |
| `read_orders` | Order placed, paid, cancelled; abandoned checkouts |
| `read_fulfillments` | Shipped, out for delivery, delivered |
| `read_customers` | Customer name, phone, consent |
| `read_products` | Product name and picture in messages |
| `read_reports`, `read_content`, `write_content` | Already used by the Growth page; keep them |

- Customer name and phone are "protected customer data". The app must have this switched on
  or Shopify sends orders with the phone blanked out.

## What exists today

- A Shopify connect screen on the Growth page. It accepts either a pasted token or a client
  ID + secret, and saves which access the store granted.
- It only pulls daily sales totals. It does not receive live events.
- Not checked yet: which of the 5 client stores are connected, and with which access.

---

## Option 1: one app per client store (do this first)

Each client's store gets its own small app called "Podo Social", created in that client's
own Dev Dashboard. The dashboard logs in with that app's client ID and secret.

### Stage 1: build (in the dashboard)

| # | Piece | What it does |
| --- | --- | --- |
| 1 | Access check | The connect screen lists the access needed and shows a green tick or red cross for each |
| 2 | Events switch | A button "Turn on live events" registers the store's events to `/api/webhooks/shopify` |
| 3 | Signature check | Every event is checked with that store's secret; anything else is rejected |
| 4 | Health line | "Last event received 2 minutes ago", and a warning if nothing arrives for 24 hours |
| 5 | Disconnect | Turns the events off in Shopify and stops all flows for that store |
| 6 | Setup guide | A step-by-step guide with screenshots, shown on the connect screen |

The connect screen after this work:

```
 Shopify store · Siyara Beauty
 ┌───────────────────────────────────────────────────────────────────┐
 │ Step 1  Create the app in Shopify           [ Open the guide ]    │
 │ Step 2  Paste the app details                                     │
 │         Store address  [ siyara.myshopify.com     ]               │
 │         Client ID      [ ......................... ]               │
 │         Client secret  [ ......................... ]   [ Connect ] │
 │ Step 3  Access                                                    │
 │         ✓ Orders   ✓ Shipping   ✗ Customers   ✓ Products          │
 │         Customers is missing: add it in Shopify, then Re-check.   │
 │ Step 4  Live events            [ Turn on live events ]            │
 │         Last event received: 2 minutes ago ●                      │
 └───────────────────────────────────────────────────────────────────┘
```

### Stage 2: test on one store

1. Create a free Shopify development store for testing. Nothing here touches a client.
2. Follow the setup guide on it, exactly as a client would, and fix every unclear step.
3. Place a test order, ship it, cancel one, and leave one checkout unfinished.
4. Check each event arrives once, with the customer's name and phone.
5. Remove one access on purpose and check the screen shows the red cross.

**Done when:** all four test events arrive with name and phone, and the health line is green.

### Stage 3: roll out to the 5 clients

Per client, about 10 minutes:

1. Open the store's Dev Dashboard (the client does it, or you as staff on their store).
2. Create an app named "Podo Social".
3. Tick the access in the table above and switch on protected customer data.
4. Install the app on the store.
5. Copy the client ID and secret into the dashboard's connect screen and press Connect.
6. Press "Turn on live events", then place one test order.

Start with one client, wait a week, then do the other four.

### Risks with Option 1

- It needs someone with owner or app-development rights on each client's store.
- If a client deletes the app or changes its secret, events stop. The health line and a
  warning on the WhatsApp page catch this.
- A store connected earlier with a pasted token must add the new access. If that old app can
  no longer be edited, it is replaced by a new Dev Dashboard app.

---

## Option 2: one Podosphere app for every store (after Option 1 works)

One app owned by Podosphere. A client clicks an install link, approves the access on
Shopify's own screen, and the store is connected. No IDs or secrets to copy.

### Why do it

- One click for the client instead of ten minutes.
- One place to add new access or new events for every store at once.
- It is what selling this as a product needs.

### Stage 1: set up

1. Create a Shopify Partner account for Podosphere (free).
2. Create the app "Podo Social" there, with the same access list.
3. Choose how it is shared. An **unlisted** app can be installed from a link by any store
   but does not appear in the Shopify App Store search. It still goes through Shopify's
   review, which is the slow part.
4. Request protected customer data access and fill in Shopify's data-handling form.

### Stage 2: build

| # | Piece | What it does |
| --- | --- | --- |
| 1 | Install link | "Connect Shopify" sends the client to Shopify's approval screen and back |
| 2 | Token handling | Stores each store's key and renews it (new apps get keys that expire) |
| 3 | Events for all stores | Declared once in the app, so every installed store sends them |
| 4 | Privacy requests | Three addresses Shopify requires: customer data request, customer delete, store delete |
| 5 | Uninstall | When a store removes the app, its flows stop and its keys are deleted |
| 6 | Move existing stores | A "Switch to the Podosphere app" button for stores on Option 1 |

### Stage 3: test and switch

1. Install on the test store from the link and repeat the four test events.
2. Submit the app to Shopify for review and answer their questions.
3. Move one client from Option 1 to Option 2, check a week, then move the rest.
4. Option 1 stays available as a fallback for any store that cannot use the shared app.

### Risks with Option 2

- Shopify's review can take weeks and may ask for changes.
- Privacy rules become Podosphere's responsibility for every store, not each client's.
- Whether an unlisted app is the right sharing type for 5–10 agency clients must be confirmed
  with Shopify before building. That is the first task of this option.

---

## Order of work

1. Option 1, Stage 1 and 2: build and test on a test store.
2. WhatsApp order flows, steps 1–3 of that plan, tested on the same test store.
3. Option 1, Stage 3: first client, then the other four.
4. Option 2, after at least two clients have run on Option 1 for two weeks.

## Decisions needed

1. Who creates the test store: you, or should I guide you through it step by step?
2. The names of the 5 client stores, so their current access can be checked (read-only).
3. For each client: who has owner access to create the app on their store?

---

## Full-access app plan (added 18 Nov 2026)

Goal: one app definition, "Podo Social", with every access the Growth dashboard needs now and
later, created in the Dev Dashboard and installed on Miphoria, Siyara Beauty and Franco Leone.
Two ways to log in are kept: Method 1 (Client ID + secret) is the main one, Method 2 (pasted
access token) is the backup.

Status: plan only. Steps 1 to 4 need no new code.

### Access list for the app

Tick all of these when creating the app, so the app does not have to be reinstalled later.

| Access | Used for | In the dashboard today |
| --- | --- | --- |
| `read_orders` | Orders, sales, AOV, abandoned checkouts | Yes |
| `read_fulfillments` | Shipped, delivered | Yes |
| `read_customers` | Customer name, phone, repeat buyers | Yes |
| `read_products` | Product names and pictures | Yes |
| `read_reports` | Visitors, sources, landing pages, devices | Yes (not tested on a real store) |
| `read_content`, `write_content` | Read and publish blogs | Yes |
| `read_all_orders` | Orders older than 60 days | No. Shopify must approve this one |
| `read_inventory` | Stock levels, out-of-stock warnings | No |
| `read_discounts` | Which coupon codes bring sales | No |
| `read_analytics` | Extra store analytics | No |
| `write_pixels`, `read_customer_events` | Per-visitor tracking (page views, add to cart) | No. Needs the web pixel build |

Also switch on **protected customer data** (name, phone, email, address), or orders arrive
with the phone blanked out.

### Method 1: Client ID + secret (main)

Shopify has no user ID and password login for apps. The Client ID and Client secret are the
app's ID and password. The dashboard swaps them for an access token by itself and renews it
every 24 hours.

- Works for: sales sync, live order events, WhatsApp order flows, blogs.
- Rule: the app and the store must be in the same Shopify organisation.

### Method 2: pasted access token (backup)

A fixed token that starts with `shpat_`, pasted once in Growth → Setup → "Admin API access
token".

- It comes from an old-style custom app made inside the store admin (Settings → Apps →
  Develop apps). Shopify stopped allowing new ones in 2026. Use this method only where the
  store still shows "Create an app" there, or already has such an app.
- Works for: sales sync and blogs only. Live events do not work in this mode today.
- Small build to close that gap (about half a day): let the token mode also accept the old
  app's "API secret key", so live events can be checked and switched on.

### Steps

1. **Check the organisations.** Open dev.shopify.com with the login that sees all three
   stores. One organisation holding all three stores means one app. Separate organisations
   mean one copy of the app per store.
2. **Create the app** "Podo Social" with the access list above and protected customer data.
   Release the version.
3. **Miphoria first.** Install, copy Client ID + secret, add Miphoria on the Clients page,
   link its ad account, then Growth → Setup → Connect → Sync now → Turn on live events.
   Place one test order.
4. **Watch for 2 to 3 days.** Sales match Shopify admin, events arrive with phone numbers,
   ROAS shows.
5. **Siyara Beauty and Franco Leone.** Same steps. Where Method 1 is not possible on a store,
   use Method 2.
6. **Builds, in this order, only if wanted:** token mode with live events (half a day),
   stock and coupon data (2 days), per-visitor web pixel (3 to 4 days), older orders once
   Shopify approves `read_all_orders`.
7. **One shared app for every store** (Option 2 above) after 5 to 6 stores are running.

### Risks

- The new access rows are not read by the dashboard yet. Ticking them is harmless, but they
  show nothing until the matching build is done.
- `read_all_orders` and protected customer data may need a short request form on Shopify.
- The connect screen has not been tested on a real store yet. Miphoria is the first test.

### Decisions needed

1. What the organisation switcher on dev.shopify.com shows (one organisation or three).
2. Whether any of the three stores still offers the old "Create an app" screen for Method 2.
3. Which of the builds in step 6 are wanted, and in what order.
