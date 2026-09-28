/**
 * Exchanges the short-lived Graph API Explorer token in META_TEST_USER_TOKEN for a long-lived
 * (~60 day) user token and writes it back into .env. Needs META_APP_ID and META_APP_SECRET in .env.
 *
 *   pnpm meta:extend-token
 *
 * The token is never printed. (CLI script: reads .env via dotenv instead of getServerEnv().)
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { GraphApiError, graphGet } from '../src/modules/social/server/integrations/providers/meta/graph-client';

async function main() {
  const { META_APP_ID: appId, META_APP_SECRET: appSecret, META_TEST_USER_TOKEN: shortToken } = process.env;
  const version = process.env.META_GRAPH_VERSION ?? 'v26.0';

  if (!appId || !appSecret) {
    console.error('Set META_APP_ID and META_APP_SECRET in .env first (App settings → Basic → App secret).');
    process.exit(1);
  }
  if (!shortToken) {
    console.error('Set META_TEST_USER_TOKEN in .env to a fresh token from Graph API Explorer first.');
    process.exit(1);
  }

  try {
    const res = await graphGet<{ access_token: string; expires_in?: number }>(
      { version },
      'oauth/access_token',
      shortToken,
      { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortToken }
    );

    const env = readFileSync('.env', 'utf8').replace(/^META_TEST_USER_TOKEN=.*$/m, `META_TEST_USER_TOKEN=${res.access_token}`);
    writeFileSync('.env', env);

    const days = res.expires_in ? Math.round(res.expires_in / 86400) : 60;
    console.log(`✔ Saved a long-lived token to .env (valid ~${days} days). Run: pnpm meta:check`);
  } catch (error) {
    if (error instanceof GraphApiError) {
      console.error(`✘ ${error.message} (code ${error.code ?? '?'})`);
      if (error.isAuthError) console.error('  The short-lived token has already expired. Generate a new one and retry within the hour.');
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
