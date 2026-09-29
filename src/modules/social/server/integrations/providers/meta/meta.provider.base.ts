import 'server-only';
import { createHmac } from 'node:crypto';
import { getServerEnv } from '@/shared/lib/env';
import { BadBodyError, RefreshTokenError } from '../../core/provider.errors';
import {
  SocialProviderBase,
  type ProviderErrorClassification,
} from '../../core/social-provider.base';
import type {
  AuthenticateParams,
  AuthTokenDetails,
  GeneratedAuthUrl,
} from '../../core/social-provider.interface';
import type { GraphList, GraphPage } from './graph-client';

const PAGE_FIELDS =
  'id,name,access_token,picture.type(large){url},instagram_business_account{id,username,profile_picture_url}';

// https://developers.facebook.com/docs/graph-api/guides/error-handling
const INVALID_TOKEN_CODE = 190;
const RETRY_CODES = new Set([1, 2, 4, 17, 32, 613]);

interface MetaTokenResponse {
  access_token: string;
  expires_in?: number;
}

interface MetaPermission {
  permission: string;
  status: 'granted' | 'declined' | 'expired';
}

interface MetaErrorBody {
  error?: { message?: string; code?: number; error_user_msg?: string };
}

type GraphParams = Record<string, string | number | boolean | undefined>;

export interface GraphRequestOptions {
  /** Short label used in error messages, e.g. "upload photo". */
  action: string;
  token?: string;
  method?: 'GET' | 'POST';
  params?: GraphParams;
  /** Multipart body for file uploads; params are added to it. */
  form?: FormData;
  /** Video uploads go to graph-video.facebook.com. */
  host?: string;
}

// Facebook Pages and Instagram business accounts share one Facebook Login app: the
// user approves Pages in the login dialog and every Page token acts as the account.
export abstract class MetaProviderBase extends SocialProviderBase {
  readonly requiredEnv = ['META_APP_ID', 'META_APP_SECRET'] as const;

  /** Shown when the login did not share any account this provider can post as. */
  protected abstract readonly noAccountsMessage: string;

  /** Turns the Pages the user shared into the accounts this provider connects. */
  protected abstract toAccounts(pages: GraphPage[]): AuthTokenDetails[];

  async generateAuthUrl(redirectUri: string): Promise<GeneratedAuthUrl> {
    const state = this.createState();
    const params = new URLSearchParams({
      client_id: this.getEnv('META_APP_ID'),
      redirect_uri: redirectUri,
      state,
      scope: this.scopes.join(','),
      response_type: 'code',
    });

    return {
      url: `https://www.facebook.com/${getServerEnv().META_GRAPH_VERSION}/dialog/oauth?${params}`,
      state,
      codeVerifier: '',
    };
  }

  async authenticate({ code, redirectUri }: AuthenticateParams): Promise<AuthTokenDetails[]> {
    const client = {
      client_id: this.getEnv('META_APP_ID'),
      client_secret: this.getEnv('META_APP_SECRET'),
    };
    const shortLived = await this.graph<MetaTokenResponse>('oauth/access_token', {
      action: 'exchange code',
      params: { ...client, redirect_uri: redirectUri, code },
    });
    // Page tokens loaded with a long-lived user token never expire.
    const { access_token: userToken } = await this.graph<MetaTokenResponse>('oauth/access_token', {
      action: 'extend token',
      params: {
        ...client,
        grant_type: 'fb_exchange_token',
        fb_exchange_token: shortLived.access_token,
      },
    });

    const permissions = await this.graph<GraphList<MetaPermission>>('me/permissions', {
      action: 'load permissions',
      token: userToken,
    });
    this.checkScopes(
      permissions.data
        .filter((entry) => entry.status === 'granted')
        .map((entry) => entry.permission)
    );

    const pages = await this.graph<GraphList<GraphPage>>('me/accounts', {
      action: 'load pages',
      token: userToken,
      params: { fields: PAGE_FIELDS, limit: 100 },
    });
    const accounts = this.toAccounts(pages.data);
    if (accounts.length === 0) {
      throw new BadBodyError(this.identifier, this.noAccountsMessage);
    }
    return accounts;
  }

  // Page tokens cannot be refreshed; a revoked one needs a reconnect.
  async refreshToken(): Promise<AuthTokenDetails> {
    throw new RefreshTokenError(this.identifier, `${this.name} must be reconnected`);
  }

  protected async graph<T>(
    path: string,
    {
      action,
      token,
      method = 'GET',
      params = {},
      form,
      host = 'graph.facebook.com',
    }: GraphRequestOptions
  ): Promise<T> {
    const url = new URL(`https://${host}/${getServerEnv().META_GRAPH_VERSION}/${path}`);
    if (token) {
      url.searchParams.set('access_token', token);
      // Required when the app has "Require App Secret" switched on; harmless otherwise.
      url.searchParams.set(
        'appsecret_proof',
        createHmac('sha256', this.getEnv('META_APP_SECRET')).update(token).digest('hex')
      );
    }

    const entries = Object.entries(params).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, String(value)] as const]
    );
    let body: FormData | URLSearchParams | undefined;
    if (form) {
      entries.forEach(([key, value]) => form.append(key, value));
      body = form;
    } else if (method === 'POST') {
      body = new URLSearchParams(entries.map(([key, value]) => [key, value]));
    } else {
      entries.forEach(([key, value]) => url.searchParams.set(key, value));
    }

    const response = await this.fetch(url.toString(), { action, method, body });
    return (await response.json()) as T;
  }

  protected override classifyError(body: string): ProviderErrorClassification | undefined {
    let error: MetaErrorBody['error'];
    try {
      error = (JSON.parse(body) as MetaErrorBody).error;
    } catch {
      return undefined;
    }
    if (!error) {
      return undefined;
    }

    const message = `${this.name}: ${error.error_user_msg || error.message || 'request failed'}`;
    if (error.code === INVALID_TOKEN_CODE) {
      return { kind: 'refresh-token', message };
    }
    if (error.code !== undefined && RETRY_CODES.has(error.code)) {
      return { kind: 'retry', message };
    }
    return { kind: 'bad-body', message };
  }
}
