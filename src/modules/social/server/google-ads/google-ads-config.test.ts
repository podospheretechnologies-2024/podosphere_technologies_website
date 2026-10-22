import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Access level is granted per Google Cloud project since developer tokens were sunset
// (9 Sep 2026), so the connector must be usable with the OAuth client alone.
const env: Record<string, string | undefined> = {};

vi.mock('@/shared/lib/env', () => ({ getServerEnv: () => env }));
vi.mock('@/shared/lib/crypto', () => ({
  encrypt: (value: string) => `enc:${value}`,
  decrypt: (value: string) => value.replace(/^enc:/, ''),
}));
vi.mock('@/shared/server/client-scope', () => ({ scopeWhere: () => ({}) }));
vi.mock('./google-ads-oauth-state', () => ({
  googleAdsOAuthState: { save: async () => 'state-token', consume: async () => null },
}));

const prismaMock = {
  socialGoogleAdsConnection: { findUnique: vi.fn(), update: vi.fn() },
  socialGoogleAdsAccount: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
};
vi.mock('@/shared/lib/prisma', () => ({ prisma: prismaMock }));

const { googleAdsService } = await import('./google-ads.service');

const connection = {
  id: 'conn-1',
  organizationId: 'org-1',
  accessToken: 'enc:access-token',
  refreshToken: 'enc:refresh-token',
  tokenExpiration: new Date(Date.now() + 60 * 60 * 1000),
};

beforeEach(() => {
  vi.restoreAllMocks();
  for (const key of Object.keys(env)) delete env[key];
  env.GOOGLE_CLIENT_ID = 'client-id';
  env.GOOGLE_CLIENT_SECRET = 'client-secret';
  env.APP_URL = 'https://social.example.com';
  prismaMock.socialGoogleAdsConnection.findUnique.mockResolvedValue(connection);
  prismaMock.socialGoogleAdsConnection.update.mockResolvedValue(connection);
  prismaMock.socialGoogleAdsAccount.deleteMany.mockResolvedValue({ count: 0 });
});

/** Captures the headers of every outbound Google Ads request. */
function stubFetch() {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    // No accessible customers: discovery stops after the first call.
    return new Response(JSON.stringify({ resourceNames: [] }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

describe('isConfigured', () => {
  it('is satisfied by the OAuth client alone — no developer token needed', () => {
    expect(googleAdsService.isConfigured()).toBe(true);
  });

  it('is false when the OAuth client is missing', () => {
    delete env.GOOGLE_CLIENT_SECRET;
    expect(googleAdsService.isConfigured()).toBe(false);
  });

  it('stays configured whether or not a legacy developer token is present', () => {
    env.GOOGLE_ADS_DEVELOPER_TOKEN = 'legacy-token';
    expect(googleAdsService.isConfigured()).toBe(true);
  });
});

describe('getStatus', () => {
  it('reports no missing env when only the OAuth client is set', async () => {
    prismaMock.socialGoogleAdsConnection.findUnique.mockResolvedValue(null);
    const status = await googleAdsService.getStatus({ organizationId: 'org-1' } as never);
    expect(status.connection.configured).toBe(true);
    expect(status.connection.missing).toEqual([]);
  });
});

describe('getConnectUrl', () => {
  it('requests the adwords scope with offline access and our callback', async () => {
    const { url } = await googleAdsService.getConnectUrl('org-1');
    const params = new URL(url).searchParams;
    expect(params.get('scope')).toContain('https://www.googleapis.com/auth/adwords');
    expect(params.get('redirect_uri')).toBe(
      'https://social.example.com/api/social/ads/google/callback'
    );
    expect(params.get('access_type')).toBe('offline');
    expect(params.get('state')).toBe('state-token');
  });
});

describe('oauth client selection', () => {
  it('falls back to the shared Google client when no Ads client is set', async () => {
    const { url } = await googleAdsService.getConnectUrl('org-1');
    expect(new URL(url).searchParams.get('client_id')).toBe('client-id');
  });

  it('prefers the Ads-only client so a separate Cloud project can hold the access level', async () => {
    env.GOOGLE_ADS_CLIENT_ID = 'ads-client-id';
    env.GOOGLE_ADS_CLIENT_SECRET = 'ads-client-secret';
    const { url } = await googleAdsService.getConnectUrl('org-1');
    expect(new URL(url).searchParams.get('client_id')).toBe('ads-client-id');
  });

  it('stays configured on the Ads client alone', () => {
    delete env.GOOGLE_CLIENT_ID;
    delete env.GOOGLE_CLIENT_SECRET;
    env.GOOGLE_ADS_CLIENT_ID = 'ads-client-id';
    env.GOOGLE_ADS_CLIENT_SECRET = 'ads-client-secret';
    expect(googleAdsService.isConfigured()).toBe(true);
  });

  it('does not pair an Ads client id with the shared secret', async () => {
    env.GOOGLE_ADS_CLIENT_ID = 'ads-client-id';
    prismaMock.socialGoogleAdsConnection.findUnique.mockResolvedValue(null);
    const status = await googleAdsService.getStatus({ organizationId: 'org-1' } as never);
    expect(status.connection.missing).toEqual(['GOOGLE_ADS_CLIENT_SECRET']);
  });

  it('names the Ads vars when nothing is set', async () => {
    delete env.GOOGLE_CLIENT_ID;
    delete env.GOOGLE_CLIENT_SECRET;
    prismaMock.socialGoogleAdsConnection.findUnique.mockResolvedValue(null);
    const status = await googleAdsService.getStatus({ organizationId: 'org-1' } as never);
    expect(status.connection.missing).toEqual(['GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET']);
  });
});

describe('developer-token header', () => {
  it('is omitted when no token is configured', async () => {
    const calls = stubFetch();
    await googleAdsService.refresh('org-1');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('customers:listAccessibleCustomers');
    expect(calls[0].headers).not.toHaveProperty('developer-token');
    expect(calls[0].headers.Authorization).toBe('Bearer access-token');
  });

  it('is still sent when a legacy token is configured', async () => {
    env.GOOGLE_ADS_DEVELOPER_TOKEN = 'legacy-token';
    const calls = stubFetch();
    await googleAdsService.refresh('org-1');
    expect(calls[0].headers['developer-token']).toBe('legacy-token');
  });
});

describe('api version', () => {
  it('defaults to v24 and honours an override', async () => {
    const calls = stubFetch();
    await googleAdsService.refresh('org-1');
    expect(calls[0].url).toContain('/v24/');

    env.GOOGLE_ADS_API_VERSION = 'v26';
    const next = stubFetch();
    await googleAdsService.refresh('org-1');
    expect(next[0].url).toContain('/v26/');
  });
});
