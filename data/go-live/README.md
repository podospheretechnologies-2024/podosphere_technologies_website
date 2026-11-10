# Podosphere go-live pack (prepared 31 Oct 2026, updated 1 Nov 2026)

Assets to take Podosphere's own channels live on Podo Social, approval-first.

| File | Use |
|---|---|
| `brand-kit.json` | Values for the 17 brand-kit fields. Paste into Dashboard > AI > Brand kit with the "PodoSphere Technologies" client selected. `logo_url` is empty: add a hosted PNG. |
| `week1-content-pack.md` | 24 posts for the week of 3 to 9 Nov 2026: hook, caption, media brief, status. Drafted by Claude; every one still needs your approval and most need media produced. |
| `week1-text-posts.csv` | The 5 text-only posts in the product's CSV importer format (`date,time,channels,text,media_url`; times are IST). The importer schedules each row, so import only after you approve the text. Rows for channels that are not connected yet show "Unknown channel" in the preview until you connect them. |

## Verified state

31 Oct 2026, read-only checks:

- Production app `https://social.podospheretechnologies.com` healthy: DB, Redis and all workers up.
- Meta app Podo Social (1425390532878774) is live. System-user token "PodoSocialserver" is valid, never expires, issued by this app, and can act on Page PodoSphere Technologies (259986377195834, 46 followers) and Instagram @podo_sphere (17841459370728904, 1,074 followers).
- WhatsApp +91 91191 05802 is verified (quality GREEN) with webhooks already routed to production.
- Ad account act_623028240126874 active.
- MCP servers Meta Social Technologies, Meta Ads and WhatsApp Business Tools all respond. WhatsApp is authorized for the PodoSphere business only.

1 Nov 2026, applied with your approval:

- App-level webhook topics `page` (feed, messages, leadgen) and `instagram` (comments, messages) are subscribed on app 1425390532878774 to `https://social.podospheretechnologies.com/api/webhooks/meta` with include_values on. Production answered Meta's verify handshake and rejects bad signatures (HTTP 401).
- The per-Page `subscribed_apps` call is made automatically when you connect Facebook or Instagram (`src/modules/social/server/integrations/integration.service.ts`), so no extra step is needed after step 3 below.

## Blockers found

1. `ANTHROPIC_API_KEY` is empty, so Podo AI cannot draft anything. Either set it in the production `.env` and restart, or set an Anthropic key per client under AI > Provider (admin only).
2. `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` are not set, so LinkedIn cannot be connected. The plan goes live on LinkedIn + Instagram first.
3. Resolved 1 Nov 2026: `page` and `instagram` webhook topics are now subscribed (see above).
4. X and TikTok are not supported by the product. Those posts in the plan are manual.
5. `META_TEST_USER_TOKEN` has expired (only `pnpm meta:check` uses it).
6. App Review is unsubmitted; contact email unverified; support URL missing. Not needed for Podosphere's own assets, needed before clients connect.

## Cleanup needed on production (1 Nov 2026 webhook probe)

To confirm delivery, five signed test payloads were posted to the production callback (Meta's own test-send tool cannot be confirmed from a non-interactive session). Production stored them instead of discarding them: `ownerForPage()` in `src/modules/social/server/inbox/inbox.service.ts` falls back to the oldest organization when no connected channel matches the page id. All rows carry channel id `0` and the text `webhook probe`, in the oldest organization:

- 3 inbox threads: facebook comment (externalId `0_0`), facebook DM (`0`), instagram DM (`0`, holds 2 messages)
- 5 inbox messages
- 1 lead: source `facebook`, externalId `0` (a "new lead" notification may also have fired)

Run against the production MySQL (same credentials as `scripts/backup-mysql.sh`):

```sql
SELECT id, platform, kind, externalId, lastPreview FROM social_inbox_threads
 WHERE channelInternalId = '0' AND lastPreview = 'webhook probe';
SELECT id, source, externalId FROM social_leads
 WHERE source = 'facebook' AND externalId = '0';

DELETE FROM social_inbox_messages
 WHERE threadId IN (SELECT id FROM social_inbox_threads
                    WHERE channelInternalId = '0' AND lastPreview = 'webhook probe');
DELETE FROM social_inbox_threads
 WHERE channelInternalId = '0' AND lastPreview = 'webhook probe';
DELETE FROM social_leads
 WHERE source = 'facebook' AND externalId = '0';
```

Until the fallback is removed, Meta dashboard "Test" sends and events for any page that is not connected will land in the oldest organization the same way. Recommended fix (not applied): make `ownerForPage()` return `null` when no integration matches.

## Steps that only you can do (browser)

1. Log in at `https://social.podospheretechnologies.com` as an OWNER/ADMIN.
2. Clients > New client: "PodoSphere Technologies", approver = you.
3. Channels > Connect Facebook, then Connect Instagram. On the Meta screen pick only the PodoSphere Technologies Page and @podo_sphere. Do not select any client Page.
4. AI > Provider (with the PodoSphere client selected): add an Anthropic key, or set `ANTHROPIC_API_KEY` on the server.
5. AI > Brand kit: paste the values from `brand-kit.json`.
6. Posts > CSV import: upload `week1-text-posts.csv`, review the preview, import. Build the media posts from `week1-content-pack.md` in the composer.
7. AI > Weekly plan: run it once the brand kit and channels are in place; approve from the queue.

## Server env still to add (production)

`ANTHROPIC_API_KEY`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `RESEND_API_KEY` (approval emails), optional `OPENAI_API_KEY` (AI images).
