import 'server-only';

export interface GeneratedAuthUrl {
  url: string;
  state: string;
  codeVerifier: string;
}

export interface AuthenticateParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface AuthTokenDetails {
  internalId: string;
  name: string;
  username?: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
  /** Seconds until the access token expires. */
  expiresIn?: number;
}

// Every channel (LinkedIn, X, Facebook, ...) implements this contract so the
// integration service can stay platform agnostic. Publishing methods are added
// together with the publishing worker.
export interface SocialProvider {
  readonly identifier: string;
  readonly name: string;
  readonly scopes: readonly string[];
  /** Needs an extra step after OAuth (e.g. picking a page) before it can post. */
  readonly isBetweenSteps: boolean;
  /** Refresh the token shortly before it expires instead of on failure. */
  readonly refreshWait: boolean;
  /** Environment variables that must be set for the provider to be usable. */
  readonly requiredEnv: readonly string[];

  isConfigured(): boolean;
  maxLength(): number;
  generateAuthUrl(redirectUri: string): Promise<GeneratedAuthUrl>;
  authenticate(params: AuthenticateParams): Promise<AuthTokenDetails>;
  refreshToken(refreshToken: string): Promise<AuthTokenDetails>;
}
