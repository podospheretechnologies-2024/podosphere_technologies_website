# Google Ads connector setup (Podo Social)

Operator checklist to take the Google Ads connector live. Paths are relative to this repo.
Do **not** change Google console settings from this doc — use it to verify what the code needs, then configure the consoles yourself.

> **22 Oct 2026:** the connector code is complete (migration `20261019100000_google_ads_connector`).
> Google Ads runs on its **own** Cloud project and OAuth client — `podo-social-ads`, inside the
> `podospheretechnologies.com` organization, owned by `info@podospheretechnologies.com`.
> It is deliberately separate from the personal-account project that still owns `GOOGLE_CLIENT_ID`
> (YouTube, Business Profile, Sheets), so neither can break the other.
> What remains is the **Explorer access application** and connecting once.

The connector is **read-only**: it never creates, edits or pauses Google Ads entities.
See the header comment in `src/modules/social/server/google-ads/google-ads.service.ts`.

---

## 1. What the code already does

| Step | Implementation |
|------|----------------|
| Start OAuth (admin only) | `src/app/api/social/ads/google/connect/route.ts` → `googleAdsService.getConnectUrl` |
| OAuth callback → token exchange | `src/app/api/social/ads/google/callback/route.ts` → `completeConnect` |
| CSRF state (Redis, 1h TTL) | `src/modules/social/server/google-ads/google-ads-oauth-state.ts` |
| Access-token refresh | `getValidAccessToken` (refresh token stored encrypted) |
| Account discovery | `discoverAccounts` — `customer` then `customer_client` for manager logins |
| Spend / campaigns / ad groups / ads | `googleAdsService.overview` (GAQL via `googleAds:searchStream`) |
| Map an account to a Podo client | `assignAccount` → `social_google_ads_accounts.customerId` |
| Status + missing-env surface | `getStatus` → `src/modules/social/components/ads/google-ads-panel.tsx` |

Tables: `social_google_ads_connections` (one per organization), `social_google_ads_accounts`.
Tokens are encrypted at rest via `src/shared/lib/crypto.ts`.

---

## 2. Access level — per Cloud project, not a developer token

Google **sunset developer tokens on 9 September 2026**. API access level is now granted to the
**Google Cloud project** that issued the OAuth credentials.

| Level | Covers | Notes |
|-------|--------|-------|
| Test | Test accounts only | Granted by completing API sign-up |
| **Explorer** | Test + production | Capped ~2,880 operations/day. **Enough for this read-only dashboard.** |
| Basic | Test + production | Higher cap; also requires completed brand verification |
| Standard | Test + production | No operation cap |

**Action:** in Google Cloud Console, open **`podo-social-ads`**
→ **Google Ads API** → **Access levels** → **Manage** → apply for **Explorer**.
Apply there, not in the Google Ads API Center.

Because `overview` issues 5 GAQL calls per account per page load, Explorer's daily cap is the
number to watch if many accounts are refreshed often — not a blocker at current client counts.

---

## 3. OAuth client — Ads has its own

The connector uses `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` when they are set, and
falls back to `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` when they are not
(`oauthClient()` in `google-ads.service.ts`).

Use the dedicated pair. The shared `GOOGLE_CLIENT_*` client is consumed by **four** integrations —
YouTube and Google Business Profile (`.../integrations/providers/google/google.provider.ts`),
Google Sheets (`.../google-sheets/google-sheets.service.ts`) and Ads — so replacing it would
invalidate every stored refresh token and force all of them to reconnect.

| Item | Value |
|------|-------|
| Cloud project | `podo-social-ads` (org `podospheretechnologies.com`) |
| Client name | `Podo Social — Google Ads`, type **Web application** |
| Redirect URI (prod) | `{APP_URL}/api/social/ads/google/callback` |
| Redirect URI (local) | `http://localhost:3000/api/social/ads/google/callback` |
| JavaScript origins | **none** — the exchange is server-side; origins reject a path |
| Scopes requested | `openid`, `email`, `profile`, `https://www.googleapis.com/auth/adwords` |
| Consent flow | `access_type=offline`, `prompt=consent` (needed for the refresh token) |

Add `https://www.googleapis.com/auth/adwords` under **Data Access** on the consent screen, or the
grant comes back without it and the callback rejects it.

**Audience is `Internal`.** Only `@podospheretechnologies.com` accounts can authorize, which is all
this design needs — the client ad accounts are reached through the MCC, not by clients signing in.
Internal skips Google's OAuth verification entirely and keeps refresh tokens from expiring, even
though `adwords` is a sensitive scope. Switching to *External* later (so outside clients could
connect their own Ads accounts) means verification, and in *Testing* refresh tokens die every 7 days.

The callback rejects a grant that comes back without the `adwords` scope, with:
`Google Ads access was not granted. Allow the Google Ads permission and try again.`

---

## 4. Environment

| Var | Required | Purpose |
|-----|----------|---------|
| `GOOGLE_ADS_CLIENT_ID` | ✅ | OAuth client from `podo-social-ads` |
| `GOOGLE_ADS_CLIENT_SECRET` | ✅ | Its secret |
| `GOOGLE_CLIENT_ID` / `_SECRET` | ⬜ | Fallback only, used when the two above are blank |
| `APP_URL` | ✅ | Builds the redirect URI; must match the console exactly |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ⬜ | Manager (MCC) customer id, **digits only, no dashes**. Sent as `login-customer-id`. |
| `GOOGLE_ADS_API_VERSION` | ⬜ | Defaults to `v24` (sunset ~May 2027). Set to `v25`/`v26` to move up. |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | ⬜ | Legacy only. Sent as `developer-token` when set, omitted when blank. |

`isConfigured()` is satisfied by a client id + secret alone (either pair). With those set the
**Connect Google Ads** button is enabled; no developer-token application is needed.

---

## 5. Connect and verify

1. Sign in as `OWNER` or `ADMIN` (all Google Ads routes call `requireRole('ADMIN')`).
2. Open the Ads page → **Google** tab → **Connect Google Ads**.
3. Grant the Google Ads permission. The callback returns to the Ads page with `googleAds=connected`.
4. Accounts are discovered and saved immediately on connect. **Refresh** re-runs discovery.
5. Assign each ad account to a Podo client so client-scoped users see only their own spend.

Redis must be running — the OAuth state lives there, and a missing state fails with
`Invalid or expired Google authorization state`.

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Connect button disabled | No OAuth client id/secret in either pair; the panel lists which var to set |
| `Error 403: org_internal` | Signed in with a Google account outside `podospheretechnologies.com` (§3) |
| `redirect_uri_mismatch` | Console URI ≠ `{APP_URL}/api/social/ads/google/callback` (scheme, port and trailing path must match) |
| `Google Ads access was not granted` | The `adwords` checkbox was unticked on the consent screen |
| `Invalid or expired Google authorization state` | Redis restarted, or the flow took over 1h |
| `Google session expired` (401) | Refresh token missing or revoked — connect again (`prompt=consent` reissues it) |
| `Google Ads: ...` 403 with a quota/access message | Cloud project still at **Test** level — apply for Explorer (§2) |
| No accounts after connect | The login has no accessible accounts, or a manager login needs `GOOGLE_ADS_LOGIN_CUSTOMER_ID` |
| `Google Ads rate limit reached` (429) | Explorer daily cap — space out refreshes |
| 404 on the Ads routes | `canUseAds(organization)` is false for this org |

Google's errors are surfaced verbatim (`Google Ads: <detail>`) by `adsRequest`, so the message in
the UI is the message Google returned.

---

## 7. Still open

- [x] Cloud project `podo-social-ads` created under the org, Google Ads API enabled (§2)
- [x] OAuth consent screen configured, audience **Internal** (§3)
- [x] OAuth client `Podo Social — Google Ads` created with both redirect URIs (§3)
- [ ] Add scope `https://www.googleapis.com/auth/adwords` under **Data Access** (§3)
- [ ] Apply for **Explorer** access: Google Ads API → Access levels → Manage (§2)
- [x] Put the client id + secret in `.env` as `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` (§4) — dedicated client, distinct from the shared `GOOGLE_CLIENT_*`
- [ ] Link the 4 client ad accounts into MCC `987-922-1937` — it currently has none
- [ ] Set `GOOGLE_ADS_LOGIN_CUSTOMER_ID=9879221937` once they are linked (§4)
- [ ] Connect once in prod and assign ad accounts to clients (§5)
- [ ] Admin marketplace dashboard still shows **sample** Google data (`src/modules/admin/data/marketplace-ads.sample.ts`) — not wired to this connector
- [ ] Longer term: migrate the personal-account project that owns `GOOGLE_CLIENT_ID` into the org,
      so YouTube / Business Profile / Sheets stop depending on a personal Gmail
- [ ] `v24` is pinned; move to `v25`/`v26` before the ~May 2027 sunset

Config is covered by `src/modules/social/server/google-ads/google-ads-config.test.ts`.

See also: `SOCIAL_PENDING.md`, `docs/ops-runbook.md`, `.env.example`.
