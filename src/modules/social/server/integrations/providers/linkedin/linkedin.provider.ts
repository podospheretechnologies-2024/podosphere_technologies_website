import 'server-only';
import { SocialProviderBase } from '../../core/social-provider.base';
import type {
  AuthenticateParams,
  AuthTokenDetails,
  GeneratedAuthUrl,
} from '../../core/social-provider.interface';

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface LinkedInUserInfo {
  sub: string;
  name: string;
  picture?: string;
}

// Personal LinkedIn profile. Uses the self-serve "Sign In with LinkedIn using
// OpenID Connect" and "Share on LinkedIn" products.
export class LinkedInProvider extends SocialProviderBase {
  readonly identifier = 'linkedin';
  readonly name = 'LinkedIn';
  readonly scopes = ['openid', 'profile', 'w_member_social'] as const;
  readonly requiredEnv = ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'] as const;
  override readonly refreshWait = true;

  maxLength() {
    return 3000;
  }

  async generateAuthUrl(redirectUri: string): Promise<GeneratedAuthUrl> {
    const state = this.createState();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.getEnv('LINKEDIN_CLIENT_ID'),
      redirect_uri: redirectUri,
      state,
      scope: this.scopes.join(' '),
    });

    return { url: `${AUTHORIZE_URL}?${params}`, state, codeVerifier: '' };
  }

  async authenticate({ code, redirectUri }: AuthenticateParams): Promise<AuthTokenDetails> {
    const token = await this.requestToken(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      },
      'exchange code'
    );
    this.checkScopes(token.scope);

    return this.toAuthDetails(token);
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    const token = await this.requestToken(
      { grant_type: 'refresh_token', refresh_token: refreshToken },
      'refresh token'
    );

    return this.toAuthDetails({ ...token, refresh_token: token.refresh_token ?? refreshToken });
  }

  private async requestToken(
    params: Record<string, string>,
    action: string
  ): Promise<LinkedInTokenResponse> {
    const response = await this.fetch(TOKEN_URL, {
      action,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...params,
        client_id: this.getEnv('LINKEDIN_CLIENT_ID'),
        client_secret: this.getEnv('LINKEDIN_CLIENT_SECRET'),
      }),
    });

    return (await response.json()) as LinkedInTokenResponse;
  }

  private async toAuthDetails(token: LinkedInTokenResponse): Promise<AuthTokenDetails> {
    const response = await this.fetch(USERINFO_URL, {
      action: 'load profile',
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const profile = (await response.json()) as LinkedInUserInfo;

    return {
      internalId: profile.sub,
      name: profile.name,
      picture: profile.picture,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
    };
  }
}
