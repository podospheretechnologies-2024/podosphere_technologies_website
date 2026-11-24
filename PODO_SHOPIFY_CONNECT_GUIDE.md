# Connect a client's Shopify store to Podo Social

This guide connects one client's Shopify store to the Podo Social dashboard, so the dashboard
can show the store's orders, sales, customers and products. It takes about 15 minutes per store.

Repeat the whole guide for every store. One Shopify app works for one store only, so each
client store gets its own app.

## What you need before you start

| You need | Why |
| --- | --- |
| Login to the Podosphere Shopify Partner account (dev.shopify.com) | The app is created there |
| Owner or staff login to the client's Shopify admin, with permission to install apps | The app is installed on the store |
| Admin login to the dashboard, https://social.podospheretechnologies.com | The store is connected there |
| The client already added on the dashboard's **Clients** page | The store is attached to that client |

Use one browser for all of it, logged in to all three.

## Part 1: find the store's address

1. Open the client's Shopify admin.
2. Go to **Settings → Domains**.
3. Note the address that ends in `.myshopify.com`, for example `siyara-beauty.myshopify.com`.

The public website address (for example `francoleone.in`) does not work. Only the
`.myshopify.com` address does.

## Part 2: create the app

1. Open https://dev.shopify.com and choose the Podosphere organisation.
2. Go to **Apps → Create app**. Name it `Podo Social <client name>`, for example
   `Podo Social Siyara`.
3. Open the app's **Versions** and start a new version.
4. Set **App URL** to:
   ```
   https://social.podospheretechnologies.com
   ```
5. Switch off **Embed app in Shopify admin**.
6. Under **Access → Scopes**, paste this list exactly:
   ```
   read_orders,read_fulfillments,read_customers,read_products,read_reports,read_content,write_content,read_inventory,read_locations,read_discounts,read_returns,read_marketing_events,read_files,read_publications
   ```
7. Under **Allowed redirection URL(s)**, paste this address exactly:
   ```
   https://social.podospheretechnologies.com/api/social/growth/shopify/oauth/callback
   ```
8. Press **Release** to publish the version.

Both the list and the address can also be copied from the dashboard: **Growth → Setup →
Connect with Shopify**, buttons **Copy list** and **Copy address**.

Do not add `read_all_orders` to the list. Shopify rejects it until they approve it separately.

## Part 3: install the app on the store

1. In the app, open **Distribution** and choose **Custom distribution**.
2. Enter the store's `.myshopify.com` address from Part 1.
3. Generate the install link.
4. Open the link in the browser where you are logged in to the client's Shopify admin.
5. Check the store name on the page is the right client, then press **Install**.

The choice of store is permanent for this app. If the wrong store was entered, create a new app.

## Part 4: connect in the dashboard

1. In the Shopify app, open **Settings** and copy the **Client ID** and the **Client secret**.
2. Open https://social.podospheretechnologies.com and log in.
3. Pick the client in the client switcher at the top of the page.
4. Go to **Growth → Setup**.
5. Under "Paste the app details", choose **Connect with Shopify**.
6. Fill in:
   - **Store address (myshopify.com)**: the address from Part 1
   - **Client ID**
   - **Client secret**
7. Press **Connect with Shopify**.
8. Shopify shows an approval page. Approve it. You come back to the Setup tab with the store
   connected.

## Part 5: switch it on and check

1. On the Setup tab, look at the access list. Every row should have a green tick, except
   "orders older than 60 days", which stays red until Shopify approves it.
2. Press **Sync now**. It pulls the last 60 days of orders.
3. Press **Turn on live events**.
4. Place one test order on the store.
5. Check the order appears in the dashboard, with the customer's name and phone number.

The store is connected when the test order shows up with a phone number.

## If something goes wrong

| What you see | Cause | Fix |
| --- | --- | --- |
| `shop_not_permitted` | The **Client ID + secret** tab was used | Use the **Connect with Shopify** tab instead |
| Shopify says the redirect address is not allowed | The address in Part 2 step 7 is missing, has a typo, or the version was not released | Paste it again exactly, then release a new version |
| Shopify says the app cannot be installed on this store | The install link was made for a different store | Create a new app for this store |
| A red cross next to an access row | That permission is missing from the app version | Add it in a new version, release it, then connect again |
| Orders arrive but the phone number is blank | Protected customer data is not switched on | In the app, open **API access requests** and request protected customer data (name, phone, email, address) |
| Only the last 60 days of orders appear | `read_all_orders` is not approved | Normal. Request it from Shopify in **API access requests** if older orders are needed |
| The store stops updating later | The app was removed from the store, or its secret was changed | Reinstall the app or copy the new secret, then connect again |

## Rules for the Client secret

- The Client secret is a password. Paste it only into the dashboard's Setup tab.
- Do not send it by email or chat, and do not save it in the code repository.
- If it was shared by mistake, rotate it in the app's **Settings**, then connect the store
  again with the new secret.

## Checklist per store

- [ ] `.myshopify.com` address noted
- [ ] App created and named `Podo Social <client name>`
- [ ] Permissions pasted
- [ ] Redirection address pasted
- [ ] Version released
- [ ] App installed on the right store
- [ ] Connected in the dashboard under the right client
- [ ] Sync now pressed
- [ ] Live events turned on
- [ ] Test order arrived with a phone number
