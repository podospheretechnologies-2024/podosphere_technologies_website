/**
 * Runs the read-only Graph API test calls from PODO_SOCIAL.md section 10 with META_TEST_USER_TOKEN
 * and prints the IDs we need to record (Page ID, IG Business ID). Also counts toward App Review usage.
 *
 *   pnpm meta:check
 *
 * Only GET requests. Nothing is created, changed or paused.
 * (CLI script: reads .env via dotenv instead of getServerEnv(), which is server-only.)
 */
import 'dotenv/config';
import {
  GraphApiError,
  graphGet,
  type GraphConfig,
  type GraphList,
  type GraphPage,
} from '../src/modules/social/server/integrations/providers/meta/graph-client';

const token = process.env.META_TEST_USER_TOKEN ?? '';
const adAccount = process.env.META_AD_ACCOUNT_ID ?? 'act_623028240126874';
const config: GraphConfig = {
  version: process.env.META_GRAPH_VERSION ?? 'v26.0',
  appSecret: process.env.META_APP_SECRET || undefined,
};

let passed = 0;
let failed = 0;

async function check<T>(label: string, run: () => Promise<T>, show: (r: T) => string): Promise<T | undefined> {
  try {
    const result = await run();
    passed++;
    console.log(`  ✔ ${label}\n      ${show(result)}`);
    return result;
  } catch (error) {
    failed++;
    const msg =
      error instanceof GraphApiError
        ? `${error.message} (code ${error.code ?? '?'}${error.subcode ? `/${error.subcode}` : ''})`
        : String(error);
    console.log(`  ✘ ${label}\n      ${msg}`);
    if (error instanceof GraphApiError && error.isAuthError) {
      console.log(`\n  The token used for "${label}" is expired or invalid. Generate a new one in Graph API Explorer and update .env.\n`);
      process.exit(1);
    }
    return undefined;
  }
}

/** Permissions the app needs (PODO_SOCIAL.md section 8). */
const REQUIRED_SCOPES = [
  'pages_show_list', 'pages_read_engagement', 'pages_read_user_content', 'pages_manage_posts', 'pages_manage_metadata',
  'pages_manage_engagement', 'pages_messaging', 'read_insights', 'business_management', 'ads_read', 'ads_management',
  'leads_retrieval', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_comments',
  'instagram_manage_messages', 'instagram_manage_insights', 'whatsapp_business_management', 'whatsapp_business_messaging',
];

interface DebugToken {
  data: {
    is_valid: boolean;
    type?: string;
    application?: string;
    expires_at?: number;
    data_access_expires_at?: number;
    scopes?: string[];
    error?: { message: string };
  };
}

function when(unixSeconds?: number) {
  if (!unixSeconds) return 'never';
  const mins = Math.round((unixSeconds * 1000 - Date.now()) / 60000);
  const at = new Date(unixSeconds * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  return `${at} IST (${mins >= 0 ? `in ${mins >= 1440 ? `${Math.round(mins / 1440)} days` : `${mins} min`}` : 'EXPIRED'})`;
}

/** App-level checks with the app access token (app_id|…). Work even when the user token has expired. */
async function checkApp(appToken: string) {
  const appId = process.env.META_APP_ID ?? appToken.split('|')[0];

  console.log('App (app access token)');
  await check(
    'App details',
    () => graphGet<{ id: string; name: string; category?: string }>(config, appId, appToken, { fields: 'id,name,category' }),
    (r) => `${r.name} (${r.id})${r.category ? `, category: ${r.category}` : ', category not set (App settings → Basic)'}`
  );

  if (token) {
    await check(
      'debug_token on META_TEST_USER_TOKEN',
      () => graphGet<DebugToken>(config, 'debug_token', appToken, { input_token: token }),
      ({ data: d }) => {
        if (!d.is_valid) return `INVALID: ${d.error?.message ?? 'unknown reason'}`;
        const missing = REQUIRED_SCOPES.filter((s) => !d.scopes?.includes(s));
        return [
          `valid ${d.type ?? ''} token for ${d.application ?? appId}`,
          `expires: ${when(d.expires_at)}`,
          `data access expires: ${when(d.data_access_expires_at)}`,
          missing.length ? `missing permissions: ${missing.join(', ')}` : 'all required permissions granted',
        ].join('\n      ');
      }
    );
  }

  await check(
    'Webhook subscriptions',
    () =>
      graphGet<GraphList<{ object: string; callback_url: string; active: boolean; fields: { name: string }[] }>>(
        config,
        `${appId}/subscriptions`,
        appToken
      ),
    (r) =>
      r.data.map((s) => `${s.object} → ${s.callback_url} [${s.active ? 'active' : 'inactive'}] ${s.fields.map((f) => f.name).join(', ')}`)
        .join('\n      ') || '(none yet; configured in Phase 3)'
  );
  console.log('');
}

async function main() {
  const appToken = process.env.META_APP_TOKEN ?? '';
  if (!token && !appToken) {
    console.error('Set META_TEST_USER_TOKEN and/or META_APP_TOKEN in .env');
    process.exit(1);
  }
  console.log(`\nMeta Graph API check (${config.version}${config.appSecret ? ', with appsecret_proof' : ''})\n`);

  if (appToken) await checkApp(appToken);
  if (!token) {
    console.log(`${passed} passed, ${failed} failed (no META_TEST_USER_TOKEN, user checks skipped)\n`);
    process.exit(failed ? 1 : 0);
  }

  console.log('User');
  await check(
    'me?fields=id,name,email',
    () => graphGet<{ id: string; name: string; email?: string }>(config, 'me', token, { fields: 'id,name,email' }),
    (r) => `${r.name} (${r.id})${r.email ? ` <${r.email}>` : ''}`
  );
  await check(
    'me/permissions',
    () => graphGet<GraphList<{ permission: string; status: string }>>(config, 'me/permissions', token),
    (r) => {
      const granted = r.data.filter((p) => p.status === 'granted').map((p) => p.permission);
      const declined = r.data.filter((p) => p.status !== 'granted').map((p) => p.permission);
      return `${granted.length} granted: ${granted.join(', ')}${declined.length ? `\n      declined: ${declined.join(', ')}` : ''}`;
    }
  );
  await check(
    'me/businesses',
    () => graphGet<GraphList<{ id: string; name: string }>>(config, 'me/businesses', token, { fields: 'id,name' }),
    (r) => r.data.map((b) => `${b.name} (${b.id})`).join(', ') || '(none)'
  );

  console.log('\nPages + Instagram');
  const pages = await check(
    'me/accounts?fields=id,name,instagram_business_account',
    () =>
      graphGet<GraphList<GraphPage>>(config, 'me/accounts', token, {
        fields: 'id,name,category,access_token,instagram_business_account{id,username}',
        limit: 100,
      }),
    (r) =>
      r.data
        .map(
          (p) =>
            `${p.name} — Page ID ${p.id}${p.instagram_business_account ? `, IG @${p.instagram_business_account.username} (${p.instagram_business_account.id})` : ', no IG linked'}`
        )
        .join('\n      ') || '(no Pages)'
  );

  // Page-level calls use the Page's own token, like the real app will.
  // Our own Page (META_PAGE_ID). Never fall back to a client Page.
  const podoPage = pages?.data.find((p) => p.id === process.env.META_PAGE_ID);
  if (!podoPage) console.log(`
  ⚠ Page ${process.env.META_PAGE_ID ?? "(META_PAGE_ID not set)"} not found in me/accounts`);
  if (podoPage?.access_token) {
    const pageToken = podoPage.access_token;
    console.log(`\nPage: ${podoPage.name} (${podoPage.id})`);
    await check(
      'Page fields',
      () =>
        graphGet<{ name: string; fan_count?: number; followers_count?: number }>(config, podoPage.id, pageToken, {
          fields: 'name,fan_count,followers_count',
        }),
      (r) => `followers ${r.followers_count ?? '?'}, likes ${r.fan_count ?? '?'}`
    );
    await check(
      'Page posts (last 5)',
      () =>
        graphGet<GraphList<{ id: string; message?: string; created_time: string }>>(
          config,
          `${podoPage.id}/posts`,
          pageToken,
          { fields: 'message,created_time', limit: 5 }
        ),
      (r) => r.data.map((p) => `${p.created_time.slice(0, 10)} ${(p.message ?? '(no text)').slice(0, 60)}`).join('\n      ') || '(none)'
    );
    await check(
      'Page lead forms',
      () =>
        graphGet<GraphList<{ id: string; name: string; status: string }>>(config, `${podoPage.id}/leadgen_forms`, pageToken, {
          fields: 'name,status',
        }),
      (r) => r.data.map((f) => `${f.name} [${f.status}]`).join(', ') || '(none)'
    );

    const ig = podoPage.instagram_business_account;
    if (ig) {
      console.log(`\nInstagram: @${ig.username ?? ig.id}`);
      await check(
        'IG profile',
        () =>
          graphGet<{ username: string; followers_count: number; media_count: number }>(config, ig.id, token, {
            fields: 'username,followers_count,media_count',
          }),
        (r) => `@${r.username}: ${r.followers_count} followers, ${r.media_count} posts`
      );
      await check(
        'IG media (last 5)',
        () =>
          graphGet<GraphList<{ id: string; caption?: string; comments_count?: number }>>(config, `${ig.id}/media`, token, {
            fields: 'id,caption,comments_count',
            limit: 5,
          }),
        (r) => r.data.map((m) => `${(m.caption ?? '(no caption)').slice(0, 50)} — ${m.comments_count ?? 0} comments`).join('\n      ') || '(none)'
      );
      await check(
        'IG insights (reach, day)',
        () =>
          graphGet<GraphList<{ name: string; values?: { value: number }[] }>>(config, `${ig.id}/insights`, token, {
            metric: 'reach',
            period: 'day',
          }),
        (r) => r.data.map((m) => `${m.name}: ${m.values?.map((v) => v.value).join(', ') ?? '?'}`).join('; ') || '(none)'
      );
    }
  }

  console.log(`\nAds (${adAccount}, read-only)`);
  await check(
    'Campaigns',
    () =>
      graphGet<GraphList<{ id: string; name: string; status: string; objective: string }>>(
        config,
        `${adAccount}/campaigns`,
        token,
        { fields: 'name,status,objective', limit: 25 }
      ),
    (r) => r.data.map((c) => `${c.name} [${c.status}]`).join('\n      ') || '(none)'
  );
  await check(
    'Insights, last 30 days',
    () =>
      graphGet<GraphList<{ spend?: string; impressions?: string; reach?: string }>>(config, `${adAccount}/insights`, token, {
        fields: 'spend,impressions,reach',
        date_preset: 'last_30d',
      }),
    (r) => {
      const i = r.data[0];
      return i ? `spend ₹${i.spend ?? 0}, impressions ${i.impressions ?? 0}, reach ${i.reach ?? 0}` : '(no delivery)';
    }
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main();
