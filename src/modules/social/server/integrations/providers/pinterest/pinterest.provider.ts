import 'server-only';
import { BadBodyError } from '../../core/provider.errors';
import { SocialProviderBase } from '../../core/social-provider.base';
import type {
  AuthenticateParams,
  AuthTokenDetails,
  GeneratedAuthUrl,
  PublishItem,
  PublishResult,
  PublishTarget,
} from '../../core/social-provider.interface';

const AUTHORIZE_URL = 'https://www.pinterest.com/oauth/';
const TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';
const API_URL = 'https://api.pinterest.com/v5';
const PIN_URL = 'https://www.pinterest.com/pin';

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 800;
const DEFAULT_BOARD_NAME = 'Podo Social';

interface PinterestTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  response_type?: string;
}

interface PinterestUserAccount {
  id?: string;
  username?: string;
  business_name?: string;
  profile_image?: string;
  account_type?: string;
}

interface PinterestBoard {
  id: string;
  name?: string;
}

interface PinterestBoardList {
  items?: PinterestBoard[];
}

interface PinterestPin {
  id?: string;
}

export class PinterestProvider extends SocialProviderBase {
  readonly identifier = 'pinterest';
  readonly name = 'Pinterest';
  readonly scopes = [
    'boards:read',
    'boards:write',
    'pins:read',
    'pins:write',
    'user_accounts:read',
  ] as const;
  readonly requiredEnv = ['PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET'] as const;
  override readonly refreshWait = true;

  maxLength() {
    return DESCRIPTION_MAX;
  }

  async generateAuthUrl(redirectUri: string): Promise<GeneratedAuthUrl> {
    const state = this.createState();
    const params = new URLSearchParams({
      client_id: this.getEnv('PINTEREST_CLIENT_ID'),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.scopes.join(','),
      state,
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

    return this.toAuthDetails({
      ...token,
      refresh_token: token.refresh_token ?? refreshToken,
    });
  }

  async post(target: PublishTarget, item: PublishItem): Promise<PublishResult> {
    const image = item.media.find((media) => media.type === 'image');
    if (!image) {
      throw new BadBodyError(this.identifier, 'Pinterest pins need an image');
    }
    if (item.media.some((media) => media.type === 'video')) {
      throw new BadBodyError(this.identifier, 'Pinterest video pins are not supported yet');
    }

    const boardId = await this.resolveBoardId(target);
    const title = this.pinTitle(item.content);
    const description = item.content.slice(0, DESCRIPTION_MAX);

    const response = await this.fetch(`${API_URL}/pins`, {
      action: 'publish pin',
      method: 'POST',
      headers: this.apiHeaders(target.accessToken),
      body: JSON.stringify({
        board_id: boardId,
        title,
        description,
        media_source: {
          source_type: 'image_url',
          url: image.url,
        },
      }),
    });

    const pin = (await response.json()) as PinterestPin;
    if (!pin.id) {
      throw new BadBodyError(this.identifier, 'Pinterest did not return the id of the new pin');
    }

    return { releaseId: pin.id, releaseUrl: `${PIN_URL}/${pin.id}/` };
  }

  async comment(): Promise<PublishResult> {
    throw new BadBodyError(this.identifier, 'Pinterest comments are not published from Podo Social');
  }

  private apiHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private basicAuthHeader(): string {
    const credentials = Buffer.from(
      `${this.getEnv('PINTEREST_CLIENT_ID')}:${this.getEnv('PINTEREST_CLIENT_SECRET')}`
    ).toString('base64');
    return `Basic ${credentials}`;
  }

  private async requestToken(
    params: Record<string, string>,
    action: string
  ): Promise<PinterestTokenResponse> {
    const response = await this.fetch(TOKEN_URL, {
      action,
      method: 'POST',
      headers: {
        Authorization: this.basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });

    return (await response.json()) as PinterestTokenResponse;
  }

  private async toAuthDetails(token: PinterestTokenResponse): Promise<AuthTokenDetails> {
    const response = await this.fetch(`${API_URL}/user_account`, {
      action: 'load profile',
      headers: this.apiHeaders(token.access_token),
    });
    const profile = (await response.json()) as PinterestUserAccount;
    const username = profile.username;
    if (!username && !profile.id) {
      throw new BadBodyError(this.identifier, 'Pinterest did not return the connected account');
    }

    const boardId = await this.ensureBoard(token.access_token);

    return {
      internalId: profile.id ?? username!,
      name: profile.business_name || username || 'Pinterest',
      username: username,
      picture: profile.profile_image,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
      metadata: { boardId },
    };
  }

  private async resolveBoardId(target: PublishTarget): Promise<string> {
    const fromSettings = target.settings?.boardId;
    if (typeof fromSettings === 'string' && fromSettings.length > 0) {
      return fromSettings;
    }
    return this.ensureBoard(target.accessToken);
  }

  private async ensureBoard(accessToken: string): Promise<string> {
    const listed = await this.fetch(`${API_URL}/boards?page_size=25`, {
      action: 'list boards',
      headers: this.apiHeaders(accessToken),
    });
    const boards = (await listed.json()) as PinterestBoardList;
    const existing = boards.items?.[0];
    if (existing?.id) {
      return existing.id;
    }

    const created = await this.fetch(`${API_URL}/boards`, {
      action: 'create board',
      method: 'POST',
      headers: this.apiHeaders(accessToken),
      body: JSON.stringify({ name: DEFAULT_BOARD_NAME, privacy: 'PUBLIC' }),
    });
    const board = (await created.json()) as PinterestBoard;
    if (!board.id) {
      throw new BadBodyError(this.identifier, 'Pinterest could not create a board for new pins');
    }
    return board.id;
  }

  private pinTitle(content: string): string {
    const firstLine = content.split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
    const title = firstLine || 'Pin';
    return title.slice(0, TITLE_MAX);
  }
}
