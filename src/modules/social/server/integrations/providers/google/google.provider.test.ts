import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { YouTubeProvider } = await import('./google.provider');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = 'client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function calledUrls() {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

describe('YouTubeProvider', () => {
  it('asks for the YouTube scopes and lets the user pick the brand account', async () => {
    const { url } = await new YouTubeProvider().generateAuthUrl('https://app.test/api/social/integrations/callback/youtube');
    const params = new URL(url).searchParams;
    expect(params.get('scope')).toBe('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly');
    expect(params.get('prompt')).toBe('select_account consent');
    expect(params.get('access_type')).toBe('offline');
  });

  it('connects the channel without calling the Google profile endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'at', refresh_token: 'rt', expires_in: 3599 }))
      .mockResolvedValueOnce(
        json({ items: [{ id: 'UC123', snippet: { title: 'Client TV', customUrl: '@clienttv', thumbnails: { default: { url: 'pic' } } } }] })
      );
    const out = await new YouTubeProvider().authenticate({ code: 'c', codeVerifier: '', redirectUri: 'r' });
    expect(out).toMatchObject({ internalId: 'UC123', name: 'Client TV', username: '@clienttv', picture: 'pic', refreshToken: 'rt' });
    expect(calledUrls().some((u) => u.includes('userinfo'))).toBe(false);
  });

  it('explains when the Google account has no channel', async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: 'at' })).mockResolvedValueOnce(json({ items: [] }));
    await expect(new YouTubeProvider().authenticate({ code: 'c', codeVerifier: '', redirectUri: 'r' })).rejects.toThrow(
      /no YouTube channel/
    );
  });

  it('shows the Google error, e.g. when the API is not enabled', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'at' }))
      .mockResolvedValueOnce(json({ error: { message: 'YouTube Data API v3 has not been used in project 1' } }, 403));
    await expect(new YouTubeProvider().authenticate({ code: 'c', codeVerifier: '', redirectUri: 'r' })).rejects.toThrow(
      /YouTube Data API v3 has not been used/
    );
  });

  it('refreshes the token with a single call and keeps the refresh token', async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: 'new', expires_in: 3599 }));
    const out = await new YouTubeProvider().refreshToken('rt');
    expect(out).toMatchObject({ accessToken: 'new', refreshToken: 'rt', expiresIn: 3599 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
