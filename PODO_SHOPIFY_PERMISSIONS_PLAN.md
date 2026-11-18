sta# Podo Social: Shopify app permissions for social media marketing

Written 18 Nov 2026. Status: plan only, nothing built.
Checked against Shopify's access-scopes page and protected-customer-data page on 18 Nov 2026.
Goes with `PODO_SHOPIFY_APP_PLAN.md` (how the app is created and installed). This file is only
about **which permissions to tick and why**.

## 1. Short answer

Tick the 15 permissions in section 2 and switch on protected customer data (section 4).
All are read-only except `write_content` (publish blogs). The app can never change orders,
products, prices or customers.

Paste this in the app's access list (Dev Dashboard → app → Versions → Scopes):

```
read_orders,read_customers,read_products,read_inventory,read_locations,read_discounts,read_reports,read_content,write_content,read_fulfillments,read_returns,read_marketing_events,read_files,read_publications
```

`read_all_orders` is the 15th. Shopify's form rejects it until it is approved for the app
(section 5), so it is added afterwards in a new version.

## 2. Permissions to give

### Must have (the marketing numbers do not work without these)

| Permission | Data it gives | Used in social marketing for | Dashboard reads it today |
| --- | --- | --- | --- |
| `read_orders` | Orders, payments, refunds, shipping status, abandoned checkouts (last 60 days) | Sales, orders, AOV, ROAS (sales ÷ ad spend), cart recovery on WhatsApp | Yes |
| `read_all_orders` | Orders older than 60 days | Month-on-month and festival comparisons, repeat-buyer rate, lifetime value | No |
| `read_customers` | Customer name, phone, email, order count, segments | Repeat vs new buyers, WhatsApp messages, audience lists for ads | Yes |
| `read_products` | Products, variants, collections, pictures, prices | Best sellers, product in each post or ad, product pictures in messages | Yes |
| `read_reports` | Shopify analytics (ShopifyQL): visitors, sources, landing pages, devices, conversion rate | Website tab: which channel (Instagram, Facebook, Google) brings visits and sales | Yes, not tested on a real store |
| `read_content`, `write_content` | Blogs, articles, pages | Read and publish SEO blogs | Yes |

### Should have (makes the marketing advice better)

| Permission | Data it gives | Used in social marketing for | Dashboard reads it today |
| --- | --- | --- | --- |
| `read_inventory`, `read_locations` | Stock per product and per location | Do not advertise an out-of-stock product; push overstock | No |
| `read_discounts` | Coupon codes and automatic discounts, how often used | Which coupon / influencer code brings sales | No |
| `read_returns` | Returns and their reasons | Real profit per campaign after returns; products with high returns | No |
| `read_fulfillments` | Fulfilment services | Already asked for by the order flows; keep it | Yes |
| `read_marketing_events` | Marketing activities recorded in Shopify | Match Shopify's own marketing report with our campaigns | No |
| `read_files` | Store's image and video library | Product photos and videos for posts and ads | No |
| `read_publications` | Which sales channels a product is published on | Check a product is live on Facebook / Instagram shop before it is advertised | No |

### Later (needs an extra build, add only then)

| Permission | Data it gives | Why later |
| --- | --- | --- |
| `write_pixels` + `read_customer_events` | Each visitor's page views, add to cart, checkout started | Needs a web pixel extension inside the app (3 to 4 days of build). The two must be asked together |
| `write_marketing_events` | Lets our campaigns show inside Shopify's Marketing report | A write to the store. Needs your yes |
| `write_discounts` | Create a coupon code per campaign or influencer from the dashboard | A write to the store. Needs your yes |
| `read_markets`, `read_locales` | Countries and languages the store sells in | Only for a store that sells outside India |

## 3. Do not tick

| Permission | Reason |
| --- | --- |
| `write_orders`, `write_products`, `write_customers`, `write_inventory` | The dashboard only guides. It must never change the store |
| `read_price_rules` | Old. Removed by Shopify from API version 2026-10. `read_discounts` replaces it |
| `read_analytics` | Not in Shopify's current list. `read_reports` covers analytics. Remove it from the older plan's list |
| `read_users`, `read_taxes`, payment and payout permissions | Not marketing data. Most need Shopify's approval |
| `read_themes`, `read_script_tags`, `read_gift_cards`, `read_draft_orders` | Not needed for marketing |

## 4. Protected customer data (must be switched on)

Without this Shopify sends orders with the name, phone, email and address blank.

- In the Dev Dashboard, open the app → API access → Protected customer data → select
  **customer data** and the fields **name, phone, email, address**.
- Shopify's page shows this as "always available" for a custom app (an app installed only on
  the owner's own stores). A public app must pass Shopify's review for it.
- Not confirmed from the page: whether a Dev Dashboard custom app must still fill in the short
  reason form. If the form appears, the reasons are "order updates on WhatsApp" and "marketing
  reports for the store owner".
- Our side of the rules: keep only what is used, store tokens and customer data encrypted,
  limit staff access, delete a store's data when it disconnects.

## 5. Approvals

| Item | Approval needed |
| --- | --- |
| `read_all_orders` | **Needed (found 18 Nov 2026).** The Create app form rejected it: "Contains invalid scopes: read_all_orders". Leave it out of the pasted list, create the app, request it in the Dev Dashboard (app → Settings → Access requests → Read all orders), then add it in a new version |
| Protected customer data | See section 4 |
| Everything else in section 2 | None |

## 6. What each permission unlocks in the dashboard

| Screen | Needs | Status |
| --- | --- | --- |
| Growth hero: sales, orders, AOV, ROAS | `read_orders` | Built |
| Website: visitors, sources, landing pages, devices | `read_reports` | Built, not tested on a real store |
| WhatsApp order flows: order placed, shipped, abandoned cart | `read_orders`, `read_customers`, `read_products`, `read_fulfillments` | Built |
| Blogs: draft, approve, publish | `read_content`, `write_content` | Built |
| Older than 60 days, repeat buyers, lifetime value | `read_all_orders` | Not built |
| Stock warnings on ads and posts | `read_inventory`, `read_locations` | Not built |
| Coupon and influencer code results | `read_discounts` | Not built |
| Returns per product and campaign | `read_returns` | Not built |
| Product media picker for posts | `read_files` | Not built |
| Per-visitor funnel | `write_pixels`, `read_customer_events` | Not built |

Ticking a permission the dashboard does not read yet is harmless. It shows nothing until the
matching build is done, but the app does not have to be reinstalled later.

## 7. Steps

1. **Create or edit the app** "Podo Social" in the Dev Dashboard. Paste the list from section 1.
   Switch on protected customer data. Release the version.
2. **Install on the first store** (Miphoria in the app plan). For a store that already has the
   app, the owner must approve the new access once.
3. **Connect in the dashboard:** Growth → Setup → store address + Client ID + secret → Connect →
   Re-check. Every permission in section 2 should show a green tick.
4. **Check the data:** Sync now, compare sales with Shopify admin for 2 to 3 days, place one
   test order and confirm the phone number arrives.
5. **Builds, in this order, each only on your yes:**
   1. Access check lists the new permissions (half a day).
   2. Older orders, repeat buyers and lifetime value (1 to 2 days).
   3. Stock and coupon data (2 days).
   4. Returns per product (1 day).
   5. Product media picker (1 day).
   6. Per-visitor web pixel (3 to 4 days).
6. **Other stores:** repeat steps 1 to 4 for Siyara Beauty and Franco Leone.

## 8. Decisions needed (my pick first)

1. **Tick everything in section 2 now** → *Yes*, so no store has to approve the app twice.
2. **Coupon creation from the dashboard (`write_discounts`)** → *Not now.* It is a write to the
   store.
3. **Per-visitor web pixel** → *After the first two stores have run for two weeks.*

## 9. Rules

Read-only except publishing an approved blog. No change to a client's store without an explicit
yes. Customer phone numbers are used only for that store's own messages and reports.
