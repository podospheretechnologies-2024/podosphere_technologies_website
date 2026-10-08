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
  metadata?: Record<string, unknown>;
}

export interface PublishMedia {
  type: 'image' | 'video';
  /** Where the file was meant to go, e.g. an Instagram story or reel. */
  format: 'post' | 'reel' | 'story';
  mimeType: string;
  alt: string | null;
  /** Absolute URL of the file, for platforms that download media themselves. */
  url: string;
  /** Loads the file lazily so nothing is read for items that fail validation. */
  read(): Promise<Buffer>;
}

export interface PublishItem {
  content: string;
  media: PublishMedia[];
}

/** The connected account a post is published as. */
export interface PublishTarget {
  internalId: string;
  accessToken: string;
}

export interface PublishThread {
  /** Release id of the first post of the thread. */
  rootReleaseId: string;
  /** Release id of the item this comment follows. */
  parentReleaseId: string;
}

export interface PublishResult {
  releaseId: string;
  releaseUrl: string;
}

// Every channel (LinkedIn, X, Facebook, ...) implements this contract so the
// integration and publishing services can stay platform agnostic.
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
  /**
   * Returns one entry per account the login grants access to. Most platforms grant a single
   * account; Facebook grants every Page the user picked in the login dialog.
   */
  authenticate(params: AuthenticateParams): Promise<AuthTokenDetails | AuthTokenDetails[]>;
  refreshToken(refreshToken: string): Promise<AuthTokenDetails>;
  /** Publishes the first item of a thread. */
  post(target: PublishTarget, item: PublishItem): Promise<PublishResult>;
  /** Publishes a follow-up item (comment / reply) of an already published thread. */
  comment(target: PublishTarget, thread: PublishThread, item: PublishItem): Promise<PublishResult>;
}
