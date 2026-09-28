import 'server-only';
import { randomToken } from '@/shared/lib/crypto';
import {
  BadBodyError,
  DisconnectError,
  NotEnoughScopesError,
  ProviderError,
  RefreshTokenError,
} from './provider.errors';
import type {
  AuthenticateParams,
  AuthTokenDetails,
  GeneratedAuthUrl,
  SocialProvider,
} from './social-provider.interface';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

export type ProviderErrorKind = 'retry' | 'refresh-token' | 'bad-body' | 'disconnect';

export interface ProviderErrorClassification {
  kind: ProviderErrorKind;
  message: string;
}

export interface ProviderFetchOptions extends RequestInit {
  /** Short label used in error messages, e.g. "exchange token". */
  action?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export abstract class SocialProviderBase implements SocialProvider {
  abstract readonly identifier: string;
  abstract readonly name: string;
  abstract readonly scopes: readonly string[];
  abstract readonly requiredEnv: readonly string[];
  readonly isBetweenSteps: boolean = false;
  readonly refreshWait: boolean = false;

  abstract maxLength(): number;
  abstract generateAuthUrl(redirectUri: string): Promise<GeneratedAuthUrl>;
  abstract authenticate(params: AuthenticateParams): Promise<AuthTokenDetails>;
  abstract refreshToken(refreshToken: string): Promise<AuthTokenDetails>;

  isConfigured(): boolean {
    return this.requiredEnv.every((name) => Boolean(process.env[name]));
  }

  protected getEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new ProviderError(this.identifier, `${this.name} is not configured (missing ${name})`);
    }
    return value;
  }

  protected createState(): string {
    return randomToken(24);
  }

  // Lets a provider recognise platform specific error payloads. Returning
  // undefined falls back to status code based handling.
  protected classifyError?(body: string, status: number): ProviderErrorClassification | undefined;

  protected checkScopes(granted: string | readonly string[] | undefined) {
    const grantedScopes = Array.isArray(granted)
      ? granted
      : String(granted ?? '')
          .split(/[\s,]+/)
          .filter(Boolean);
    const missing = this.scopes.filter((scope) => !grantedScopes.includes(scope));
    if (missing.length > 0) {
      throw new NotEnoughScopesError(
        this.identifier,
        `Missing permissions: ${missing.join(', ')}. Please reconnect and approve every permission.`
      );
    }
  }

  // fetch wrapper with retries for rate limits / server errors and typed errors
  // for everything else, so callers can react (refresh token, disconnect, ...).
  protected async fetch(
    url: string,
    { action = 'request', ...init }: ProviderFetchOptions = {},
    attempt = 1
  ): Promise<Response> {
    const response = await fetch(url, init);
    if (response.ok) {
      return response;
    }

    const body = await response.text().catch(() => '');
    const classified = this.classifyError?.(body, response.status);
    const shouldRetry =
      classified?.kind === 'retry' ||
      (!classified && (response.status === 429 || response.status >= 500));

    if (shouldRetry && attempt < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS);
      return this.fetch(url, { action, ...init }, attempt + 1);
    }

    const message = classified?.message ?? `${this.name} ${action} failed (${response.status})`;

    if (classified?.kind === 'disconnect') {
      throw new DisconnectError(this.identifier, message, body);
    }
    if (classified?.kind === 'refresh-token' || (!classified && response.status === 401)) {
      throw new RefreshTokenError(this.identifier, message, body);
    }
    throw new BadBodyError(this.identifier, message, body);
  }
}
