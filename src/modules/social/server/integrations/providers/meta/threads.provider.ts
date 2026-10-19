import 'server-only';
import { getServerEnv } from '@/shared/lib/env';
import { BadBodyError } from '../../core/provider.errors';
import {
  SocialProviderBase,
  type ProviderErrorClassification,
} from '../../core/social-provider.base';
import type {
  AuthenticateParams,
  AuthTokenDetails,
  GeneratedAuthUrl,
  PublishItem,
  PublishMedia,
  PublishResult,
  PublishTarget,
  PublishThread,
} from '../../core/social-provider.interface';

const AUTHORIZE_URL = 'https://threads.net/oauth/authorize';
const PROFILE_URL = 'https://www.threads.net';
const MAX_CAROUSEL_ITEMS = 20;
const CONTAINER_POLL_INTERVAL_MS = 3000;
const CONTAINER_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const LOCAL_HOSTS = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/;

// Threads Graph error codes (THApiException / Graph).
const INVALID_TOKEN_CODE = 190;
const RETRY_CODES = new Set([1, 2, 4, 17, 32, 613]);

interface ThreadsTokenResponse {
  access_token: string;
  user_id?: number | string;
  expires_in?: number;
  /** Present on some exchanges; absent on the short-lived code exchange. */
  scope?: string;
}

interface ThreadsProfile {
  id: string;
  username?: string;
  name?: string;
  threads_profile_picture_url?: string;
}

interface GraphCreated {
  id: string;
}

interface ContainerStatus {
  status?: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';
  error_message?: string;
}

interface ThreadsErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_user_msg?: string;
  };
}

type ContainerParams = Record<string, string | boolean | number | undefined>;

/**
 * Threads (Meta Threads API on graph.threads.net).
 *
 * Uses Threads Login (not Facebook Login). Enable the "Access the Threads API"
 * use case on the Meta app; credentials are the same META_APP_ID / META_APP_SECRET.
 *
 * Scopes for connect + publish: threads_basic, threads_content_publish.
 * Not requested yet (stub / clear error when needed):
 *   threads_manage_replies, threads_read_replies, threads_manage_insights,
 *   threads_delete, threads_manage_mentions.
 */
export class ThreadsProvider extends SocialProviderBase {
  readonly identifier = 'threads';
  readonly name = 'Threads';
  readonly scopes = ['threads_basic', 'threads_content_publish'] as const;
  readonly requiredEnv = ['META_APP_ID', 'META_APP_SECRET'] as const;
  /** Long-lived tokens last ~60 days; refresh with th_refresh_token. */
  override readonly refreshWait = true;

  maxLength() {
    return 500;
  }

  async generateAuthUrl(redirectUri: string): Promise<GeneratedAuthUrl> {
    const state = this.createState();
    const params = new URLSearchParams({
      client_id: this.getEnv('META_APP_ID'),
      redirect_uri: redirectUri,
      state,
      scope: this.scopes.join(','),
      response_type: 'code',
    });
    return { url: `${AUTHORIZE_URL}?${params}`, state, codeVerifier: '' };
  }

  async authenticate({ code, redirectUri }: AuthenticateParams): Promise<AuthTokenDetails> {
    const clientId = this.getEnv('META_APP_ID');
    const clientSecret = this.getEnv('META_APP_SECRET');
    // Threads Login may append "#_" to the authorization code.
    const cleanCode = code.replace(/#_$/, '');

    const shortLived = await this.threadsForm<ThreadsTokenResponse>(
      'oauth/access_token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: cleanCode,
      },
      'exchange code'
    );

    // Upgrade to a 60-day token. The long-lived token is also used to refresh itself.
    const longLived = await this.threadsGet<ThreadsTokenResponse>(
      'access_token',
      {
        grant_type: 'th_exchange_token',
        client_secret: clientSecret,
        access_token: shortLived.access_token,
      },
      'extend token'
    );

    // Scope is not always returned on the code exchange; when Meta includes it, enforce.
    const grantedScope = longLived.scope ?? shortLived.scope;
    if (grantedScope) {
      this.checkScopes(grantedScope);
    }

    const profile = await this.threadsGet<ThreadsProfile>(
      'me',
      {
        fields: 'id,username,name,threads_profile_picture_url',
        access_token: longLived.access_token,
      },
      'load profile'
    );

    const userId = String(profile.id || shortLived.user_id || '');
    if (!userId) {
      throw new BadBodyError(this.identifier, 'Threads did not return a user id');
    }

    return {
      internalId: userId,
      name: profile.name ?? profile.username ?? 'Threads',
      username: profile.username,
      picture: profile.threads_profile_picture_url,
      accessToken: longLived.access_token,
      // Refresh uses the current long-lived access token (th_refresh_token).
      refreshToken: longLived.access_token,
      expiresIn: longLived.expires_in ?? 60 * 24 * 60 * 60,
    };
  }

  async refreshToken(currentLongLivedToken: string): Promise<AuthTokenDetails> {
    const token = await this.threadsGet<ThreadsTokenResponse>(
      'refresh_access_token',
      {
        grant_type: 'th_refresh_token',
        access_token: currentLongLivedToken,
      },
      'refresh token'
    );

    const profile = await this.threadsGet<ThreadsProfile>(
      'me',
      {
        fields: 'id,username,name,threads_profile_picture_url',
        access_token: token.access_token,
      },
      'load profile'
    );

    return {
      internalId: profile.id,
      name: profile.name ?? profile.username ?? 'Threads',
      username: profile.username,
      picture: profile.threads_profile_picture_url,
      accessToken: token.access_token,
      refreshToken: token.access_token,
      expiresIn: token.expires_in ?? 60 * 24 * 60 * 60,
    };
  }

  async post(target: PublishTarget, item: PublishItem): Promise<PublishResult> {
    return this.publishContainer(target, item);
  }

  // Follow-up composer items become replies on the root Threads post.
  async comment(
    target: PublishTarget,
    thread: PublishThread,
    item: PublishItem
  ): Promise<PublishResult> {
    return this.publishContainer(target, item, thread.rootReleaseId);
  }

  private async publishContainer(
    target: PublishTarget,
    item: PublishItem,
    replyToId?: string
  ): Promise<PublishResult> {
    const { media } = item;
    if (media.some((entry) => entry.format === 'story' || entry.format === 'reel')) {
      throw new BadBodyError(
        this.identifier,
        'Threads does not support story or reel formats via the API. Use a standard post (text and/or images).'
      );
    }
    if (media.some((entry) => entry.type === 'video')) {
      throw new BadBodyError(
        this.identifier,
        'Threads video publish is not enabled in this build yet. Post text or images (JPEG/PNG), or remove the video.'
      );
    }
    if (media.length > MAX_CAROUSEL_ITEMS) {
      throw new BadBodyError(
        this.identifier,
        `Threads posts can have up to ${MAX_CAROUSEL_ITEMS} images`
      );
    }
    media.forEach((entry) => this.assertPublishableImage(entry));

    let creationId: string;
    if (media.length === 0) {
      if (!item.content.trim()) {
        throw new BadBodyError(this.identifier, 'Threads text posts need a caption');
      }
      creationId = await this.createContainer(target, {
        media_type: 'TEXT',
        text: item.content,
        ...(replyToId ? { reply_to_id: replyToId } : {}),
      });
      // Text containers are ready immediately; no status poll.
    } else if (media.length === 1) {
      creationId = await this.createContainer(target, {
        media_type: 'IMAGE',
        image_url: media[0].url,
        text: item.content || undefined,
        ...(media[0].alt ? { alt_text: media[0].alt } : {}),
        ...(replyToId ? { reply_to_id: replyToId } : {}),
      });
      await this.waitUntilFinished(target, creationId);
    } else {
      const children: string[] = [];
      for (const entry of media) {
        children.push(
          await this.createContainer(target, {
            media_type: 'IMAGE',
            image_url: entry.url,
            is_carousel_item: true,
            ...(entry.alt ? { alt_text: entry.alt } : {}),
          })
        );
        await this.waitUntilFinished(target, children[children.length - 1]);
      }
      creationId = await this.createContainer(target, {
        media_type: 'CAROUSEL',
        children: children.join(','),
        text: item.content || undefined,
        ...(replyToId ? { reply_to_id: replyToId } : {}),
      });
      await this.waitUntilFinished(target, creationId);
    }

    const { id } = await this.threadsForm<GraphCreated>(
      `${target.internalId}/threads_publish`,
      { creation_id: creationId, access_token: target.accessToken },
      'publish post'
    );

    return { releaseId: id, releaseUrl: await this.permalink(target, id) };
  }

  private assertPublishableImage(media: PublishMedia) {
    const mime = media.mimeType.toLowerCase();
    if (mime !== 'image/jpeg' && mime !== 'image/jpg' && mime !== 'image/png') {
      throw new BadBodyError(
        this.identifier,
        'Threads images must be JPEG or PNG'
      );
    }
    if (LOCAL_HOSTS.test(new URL(media.url).hostname)) {
      throw new BadBodyError(
        this.identifier,
        'Threads downloads media from a public URL and cannot reach this computer. Set APP_URL to a public address (e.g. a Cloudflare tunnel).'
      );
    }
  }

  private async createContainer(
    target: PublishTarget,
    params: ContainerParams
  ): Promise<string> {
    const { id } = await this.threadsForm<GraphCreated>(
      `${target.internalId}/threads`,
      { ...params, access_token: target.accessToken },
      'create media container'
    );
    return id;
  }

  private async waitUntilFinished(target: PublishTarget, containerId: string): Promise<void> {
    const deadline = Date.now() + CONTAINER_PROCESSING_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const { status, error_message } = await this.threadsGet<ContainerStatus>(
        containerId,
        { fields: 'status,error_message', access_token: target.accessToken },
        'check media status'
      );
      if (status === 'FINISHED' || status === 'PUBLISHED') {
        return;
      }
      if (status === 'ERROR' || status === 'EXPIRED') {
        throw new BadBodyError(
          this.identifier,
          `Threads could not process the media${error_message ? ` (${error_message})` : ''}`
        );
      }
      await this.wait(CONTAINER_POLL_INTERVAL_MS);
    }
    throw new BadBodyError(this.identifier, 'Threads took too long to process the media');
  }

  private async permalink(target: PublishTarget, mediaId: string): Promise<string> {
    try {
      const { permalink } = await this.threadsGet<{ permalink?: string }>(
        mediaId,
        { fields: 'permalink', access_token: target.accessToken },
        'load post link'
      );
      if (permalink) {
        return permalink;
      }
    } catch {
      // Fall through to profile URL.
    }
    return PROFILE_URL;
  }

  private graphBase(): string {
    return `https://graph.threads.net/${getServerEnv().META_GRAPH_VERSION}`;
  }

  private async threadsGet<T>(
    path: string,
    params: Record<string, string | undefined>,
    action: string
  ): Promise<T> {
    const url = new URL(`${this.graphBase()}/${path.replace(/^\//, '')}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
    const response = await this.fetch(url.toString(), { action, method: 'GET' });
    return (await response.json()) as T;
  }

  private async threadsForm<T>(
    path: string,
    params: Record<string, string | boolean | number | undefined>,
    action: string
  ): Promise<T> {
    const url = `${this.graphBase()}/${path.replace(/^\//, '')}`;
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body.set(key, String(value));
      }
    }
    const response = await this.fetch(url, {
      action,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    return (await response.json()) as T;
  }

  protected override classifyError(body: string): ProviderErrorClassification | undefined {
    let error: ThreadsErrorBody['error'];
    try {
      error = (JSON.parse(body) as ThreadsErrorBody).error;
    } catch {
      return undefined;
    }
    if (!error) {
      return undefined;
    }

    const message = `${this.name}: ${error.error_user_msg || error.message || 'request failed'}`;
    const missingPermission =
      /threads_[a-z_]+/i.test(message) &&
      /permission|app review|testers/i.test(message);
    if (missingPermission) {
      return {
        kind: 'bad-body',
        message: `${message} (enable the Threads use case on the Meta app and obtain Advanced Access for the listed scope)`,
      };
    }
    if (error.code === INVALID_TOKEN_CODE) {
      return { kind: 'refresh-token', message };
    }
    if (error.code !== undefined && RETRY_CODES.has(error.code)) {
      return { kind: 'retry', message };
    }
    return { kind: 'bad-body', message };
  }
}
