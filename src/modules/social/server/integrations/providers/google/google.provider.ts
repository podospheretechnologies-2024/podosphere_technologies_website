import 'server-only';
import { BadBodyError, RefreshTokenError } from '../../core/provider.errors';
import { SocialProviderBase } from '../../core/social-provider.base';
import type {
  AuthenticateParams,
  AuthTokenDetails,
  GeneratedAuthUrl,
  PublishItem,
  PublishResult,
  PublishTarget,
} from '../../core/social-provider.interface';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function exchangeCode(clientId: string, clientSecret: string, params: AuthenticateParams) {
  const body = new URLSearchParams({
    code: params.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new RefreshTokenError('google', payload.error_description || 'Google token exchange failed');
  }
  return payload;
}

async function refreshGoogleToken(clientId: string, clientSecret: string, refreshToken: string) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new RefreshTokenError('google', payload.error_description || 'Google token refresh failed');
  }
  return payload;
}

async function googleProfile(accessToken: string): Promise<{ id: string; name: string; picture?: string }> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; name?: string; picture?: string };
  if (!response.ok || !payload.id) {
    throw new RefreshTokenError('google', 'Could not read the Google profile');
  }
  return { id: payload.id, name: payload.name || 'Google account', picture: payload.picture };
}

export class YouTubeProvider extends SocialProviderBase {
  readonly identifier = 'youtube';
  readonly name = 'YouTube';
  readonly scopes = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'] as const;
  readonly requiredEnv = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const;
  override readonly refreshWait = true;

  maxLength() {
    return 5000;
  }

  async generateAuthUrl(redirectUri: string): Promise<GeneratedAuthUrl> {
    const state = this.createState();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.getEnv('GOOGLE_CLIENT_ID'),
      redirect_uri: redirectUri,
      state,
      scope: this.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });
    return { url: `${AUTHORIZE_URL}?${params}`, state, codeVerifier: '' };
  }

  async authenticate(params: AuthenticateParams): Promise<AuthTokenDetails> {
    const token = await exchangeCode(this.getEnv('GOOGLE_CLIENT_ID'), this.getEnv('GOOGLE_CLIENT_SECRET'), params);
    const profile = await googleProfile(token.access_token!);
    const channels = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const listed = (await channels.json().catch(() => ({}))) as {
      items?: { id: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }[];
    };
    const channel = listed.items?.[0];
    return {
      internalId: channel?.id ?? profile.id,
      name: channel?.snippet?.title ?? profile.name,
      picture: channel?.snippet?.thumbnails?.default?.url ?? profile.picture,
      accessToken: token.access_token!,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    const token = await refreshGoogleToken(
      this.getEnv('GOOGLE_CLIENT_ID'),
      this.getEnv('GOOGLE_CLIENT_SECRET'),
      refreshToken
    );
    const profile = await googleProfile(token.access_token!);
    return {
      internalId: profile.id,
      name: profile.name,
      accessToken: token.access_token!,
      refreshToken,
      expiresIn: token.expires_in,
    };
  }

  async post(target: PublishTarget, item: PublishItem): Promise<PublishResult> {
    const video = item.media.find((media) => media.type === 'video');
    if (!video) {
      throw new BadBodyError(this.identifier, 'YouTube posts need a video file');
    }
    const buffer = await video.read();
    const init = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${target.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': video.mimeType,
          'X-Upload-Content-Length': String(buffer.length),
        },
        body: JSON.stringify({
          snippet: {
            title: item.content.slice(0, 100) || 'Video',
            description: item.content,
          },
          status: { privacyStatus: 'public' },
        }),
      }
    );
    const uploadUrl = init.headers.get('location');
    if (!init.ok || !uploadUrl) {
      const detail = await init.text().catch(() => '');
      throw new BadBodyError(this.identifier, detail || 'YouTube upload could not start');
    }
    const uploaded = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': video.mimeType, 'Content-Length': String(buffer.length) },
      body: new Uint8Array(buffer),
    });
    const payload = (await uploaded.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!uploaded.ok || !payload.id) {
      throw new BadBodyError(this.identifier, payload.error?.message || 'YouTube rejected the video');
    }
    return { releaseId: payload.id, releaseUrl: `https://www.youtube.com/watch?v=${payload.id}` };
  }

  async comment(): Promise<PublishResult> {
    throw new BadBodyError(this.identifier, 'YouTube comments are not published from Podo Social');
  }
}

export class GoogleBusinessProvider extends SocialProviderBase {
  readonly identifier = 'google-business';
  readonly name = 'Google Business Profile';
  readonly scopes = ['https://www.googleapis.com/auth/business.manage'] as const;
  readonly requiredEnv = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const;
  override readonly refreshWait = true;

  maxLength() {
    return 1500;
  }

  async generateAuthUrl(redirectUri: string): Promise<GeneratedAuthUrl> {
    const state = this.createState();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.getEnv('GOOGLE_CLIENT_ID'),
      redirect_uri: redirectUri,
      state,
      scope: this.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });
    return { url: `${AUTHORIZE_URL}?${params}`, state, codeVerifier: '' };
  }

  async authenticate(params: AuthenticateParams): Promise<AuthTokenDetails> {
    const token = await exchangeCode(this.getEnv('GOOGLE_CLIENT_ID'), this.getEnv('GOOGLE_CLIENT_SECRET'), params);
    const profile = await googleProfile(token.access_token!);
    const accounts = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const listed = (await accounts.json().catch(() => ({}))) as { accounts?: { name: string; accountName?: string }[] };
    const account = listed.accounts?.[0];
    return {
      internalId: account?.name ?? profile.id,
      name: account?.accountName ?? profile.name,
      picture: profile.picture,
      accessToken: token.access_token!,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    const token = await refreshGoogleToken(
      this.getEnv('GOOGLE_CLIENT_ID'),
      this.getEnv('GOOGLE_CLIENT_SECRET'),
      refreshToken
    );
    return {
      internalId: 'google-business',
      name: 'Google Business Profile',
      accessToken: token.access_token!,
      refreshToken,
      expiresIn: token.expires_in,
    };
  }

  async post(target: PublishTarget, item: PublishItem): Promise<PublishResult> {
    const locations = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${target.internalId}/locations?readMask=name,title&pageSize=1`,
      { headers: { Authorization: `Bearer ${target.accessToken}` } }
    );
    const listed = (await locations.json().catch(() => ({}))) as { locations?: { name: string }[] };
    const location = listed.locations?.[0]?.name;
    if (!location) {
      throw new BadBodyError(this.identifier, 'No Google Business location is available on this account');
    }
    const response = await fetch(`https://mybusiness.googleapis.com/v4/${location}/localPosts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${target.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ languageCode: 'en', summary: item.content.slice(0, 1500), topicType: 'STANDARD' }),
    });
    const payload = (await response.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };
    if (!response.ok || !payload.name) {
      throw new BadBodyError(this.identifier, payload.error?.message || 'Google Business rejected the post');
    }
    return { releaseId: payload.name, releaseUrl: `https://business.google.com/` };
  }

  async comment(): Promise<PublishResult> {
    throw new BadBodyError(this.identifier, 'Google Business replies are not published from the composer yet');
  }
}
