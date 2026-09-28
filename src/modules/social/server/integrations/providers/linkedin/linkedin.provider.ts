import 'server-only';
import { BadBodyError } from '../../core/provider.errors';
import { SocialProviderBase } from '../../core/social-provider.base';
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

const AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const REST_URL = 'https://api.linkedin.com/rest';
const POST_URL = 'https://www.linkedin.com/feed/update';
// LinkedIn versions its REST API monthly and retires each version after a year.
const API_VERSION = '202601';

const MAX_IMAGES = 20;
const MEDIA_POLL_INTERVAL_MS = 3000;
const MEDIA_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

// Characters with a meaning in LinkedIn's "little text" format; they must be
// escaped or the text is cut off / rejected.
const LITTLE_TEXT_RESERVED = /[\\<>#~_|[\]*(){}@]/g;

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

interface LinkedInUploadInstruction {
  uploadUrl: string;
  firstByte: number;
  lastByte: number;
}

interface LinkedInInitializeUpload {
  value: {
    uploadUrl?: string;
    image?: string;
    video?: string;
    uploadToken?: string;
    uploadInstructions?: LinkedInUploadInstruction[];
  };
}

interface LinkedInMediaStatus {
  status?: 'WAITING_UPLOAD' | 'PROCESSING' | 'AVAILABLE' | 'PROCESSING_FAILED';
}

interface LinkedInComment {
  id?: string;
  commentUrn?: string;
  $URN?: string;
}

function escapeLittleText(text: string): string {
  return text.replace(LITTLE_TEXT_RESERVED, (char) => `\\${char}`);
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

  async post(target: PublishTarget, item: PublishItem): Promise<PublishResult> {
    const videos = item.media.filter((media) => media.type === 'video');
    if (videos.length > 0 && item.media.length > 1) {
      throw new BadBodyError(this.identifier, 'LinkedIn posts can have one video or only images');
    }
    if (item.media.length > MAX_IMAGES) {
      throw new BadBodyError(this.identifier, `LinkedIn posts can have up to ${MAX_IMAGES} images`);
    }

    const mediaIds: { id: string; altText?: string }[] = [];
    for (const media of item.media) {
      const id = await this.uploadMedia(target, media);
      mediaIds.push(media.alt ? { id, altText: media.alt } : { id });
    }

    const response = await this.fetch(`${REST_URL}/posts`, {
      action: 'publish post',
      method: 'POST',
      headers: this.restHeaders(target.accessToken),
      body: JSON.stringify({
        author: this.author(target),
        commentary: escapeLittleText(item.content),
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        ...(mediaIds.length === 1 ? { content: { media: mediaIds[0] } } : {}),
        ...(mediaIds.length > 1 ? { content: { multiImage: { images: mediaIds } } } : {}),
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });

    const releaseId = response.headers.get('x-restli-id');
    if (!releaseId) {
      throw new BadBodyError(this.identifier, 'LinkedIn did not return the id of the new post');
    }

    return { releaseId, releaseUrl: `${POST_URL}/${releaseId}` };
  }

  // Follow-up items become comments on the first post. The comments API is text
  // only, so media attached to a comment is not sent.
  async comment(
    target: PublishTarget,
    thread: PublishThread,
    item: PublishItem
  ): Promise<PublishResult> {
    const response = await this.fetch(
      `${REST_URL}/socialActions/${encodeURIComponent(thread.rootReleaseId)}/comments`,
      {
        action: 'publish comment',
        method: 'POST',
        headers: this.restHeaders(target.accessToken),
        body: JSON.stringify({
          actor: this.author(target),
          object: thread.rootReleaseId,
          message: { text: escapeLittleText(item.content) },
        }),
      }
    );

    const comment = (await response.json()) as LinkedInComment;
    const releaseId = comment.commentUrn ?? comment.$URN ?? comment.id;
    if (!releaseId) {
      throw new BadBodyError(this.identifier, 'LinkedIn did not return the id of the new comment');
    }

    return {
      releaseId,
      releaseUrl: `${POST_URL}/${thread.rootReleaseId}?commentUrn=${encodeURIComponent(releaseId)}`,
    };
  }

  private author(target: PublishTarget): string {
    return `urn:li:person:${target.internalId}`;
  }

  private restHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    };
  }

  // Images are sent in one PUT; videos are split into the byte ranges LinkedIn
  // asks for and confirmed with the returned etags.
  private async uploadMedia(target: PublishTarget, media: PublishMedia): Promise<string> {
    const isVideo = media.type === 'video';
    const endpoint = isVideo ? 'videos' : 'images';
    const file = new Uint8Array(await media.read());

    const initResponse = await this.fetch(`${REST_URL}/${endpoint}?action=initializeUpload`, {
      action: `start ${media.type} upload`,
      method: 'POST',
      headers: this.restHeaders(target.accessToken),
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: this.author(target),
          ...(isVideo
            ? { fileSizeBytes: file.byteLength, uploadCaptions: false, uploadThumbnail: false }
            : {}),
        },
      }),
    });
    const { value } = (await initResponse.json()) as LinkedInInitializeUpload;
    const urn = isVideo ? value.video : value.image;
    if (!urn) {
      throw new BadBodyError(this.identifier, `LinkedIn refused the ${media.type} upload`);
    }

    const uploadHeaders = {
      Authorization: `Bearer ${target.accessToken}`,
      'Content-Type': media.mimeType,
    };

    if (isVideo) {
      const partIds: string[] = [];
      for (const part of value.uploadInstructions ?? []) {
        const response = await this.fetch(part.uploadUrl, {
          action: 'upload video',
          method: 'PUT',
          headers: { ...uploadHeaders, 'Content-Type': 'application/octet-stream' },
          body: file.subarray(part.firstByte, part.lastByte + 1),
        });
        partIds.push(response.headers.get('etag') ?? '');
      }

      await this.fetch(`${REST_URL}/videos?action=finalizeUpload`, {
        action: 'finish video upload',
        method: 'POST',
        headers: this.restHeaders(target.accessToken),
        body: JSON.stringify({
          finalizeUploadRequest: {
            video: urn,
            uploadToken: value.uploadToken ?? '',
            uploadedPartIds: partIds,
          },
        }),
      });
    } else {
      if (!value.uploadUrl) {
        throw new BadBodyError(this.identifier, 'LinkedIn refused the image upload');
      }
      await this.fetch(value.uploadUrl, {
        action: 'upload image',
        method: 'PUT',
        headers: uploadHeaders,
        body: file,
      });
    }

    await this.waitUntilAvailable(target, endpoint, urn);
    return urn;
  }

  // LinkedIn processes uploads asynchronously; a post referencing media that is
  // not available yet is rejected.
  private async waitUntilAvailable(target: PublishTarget, endpoint: string, urn: string) {
    const deadline = Date.now() + MEDIA_PROCESSING_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const response = await this.fetch(`${REST_URL}/${endpoint}/${encodeURIComponent(urn)}`, {
        action: 'check media status',
        headers: this.restHeaders(target.accessToken),
      });
      const { status } = (await response.json()) as LinkedInMediaStatus;

      if (status === 'AVAILABLE') {
        return;
      }
      if (status === 'PROCESSING_FAILED') {
        throw new BadBodyError(this.identifier, 'LinkedIn could not process the uploaded media');
      }
      await this.wait(MEDIA_POLL_INTERVAL_MS);
    }

    throw new BadBodyError(this.identifier, 'LinkedIn took too long to process the media');
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
