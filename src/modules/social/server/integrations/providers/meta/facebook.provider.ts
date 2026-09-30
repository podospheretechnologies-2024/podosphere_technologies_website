import 'server-only';
import { BadBodyError } from '../../core/provider.errors';
import type {
  AuthTokenDetails,
  PublishItem,
  PublishMedia,
  PublishResult,
  PublishTarget,
  PublishThread,
} from '../../core/social-provider.interface';
import type { GraphPage } from './graph-client';
import { MetaProviderBase } from './meta.provider.base';

const POST_URL = 'https://www.facebook.com';
const MAX_IMAGES = 10;

interface GraphCreated {
  id: string;
  post_id?: string;
}

// Facebook Page. Photos are uploaded unpublished and attached to one feed post, so
// a single photo and an album are published the same way. Story / reel formats map
// to Page Stories and Page video posts so the same media can go to Instagram + Facebook.
export class FacebookProvider extends MetaProviderBase {
  readonly identifier = 'facebook';
  readonly name = 'Facebook Page';
  readonly scopes = [
    'pages_show_list',
    'business_management',
    'pages_manage_posts',
    // pages_manage_engagement (needed to post thread follow-ups as comments) is not enabled
    // on the Meta app yet; requesting it makes Facebook Login fail with "Invalid Scopes".
    // Add it back once it is added under Use cases → Manage everything on your Page.
    'pages_read_engagement',
  ] as const;
  protected readonly noAccountsMessage =
    'No Facebook Page was shared. Reconnect and select at least one Page.';

  maxLength() {
    return 63206;
  }

  protected toAccounts(pages: GraphPage[]): AuthTokenDetails[] {
    return pages.flatMap((page) =>
      page.access_token
        ? [
            {
              internalId: page.id,
              name: page.name,
              picture: page.picture?.data.url,
              accessToken: page.access_token,
            },
          ]
        : []
    );
  }

  async post(target: PublishTarget, item: PublishItem): Promise<PublishResult> {
    const isStory = item.media.some((media) => media.format === 'story');
    if (isStory) {
      if (item.media.length !== 1) {
        throw new BadBodyError(this.identifier, 'A Facebook story can have one image or video');
      }
      return this.publishStory(target, item.media[0]);
    }

    const videos = item.media.filter((media) => media.type === 'video');
    if (videos.length > 0 && item.media.length > 1) {
      throw new BadBodyError(this.identifier, 'Facebook posts can have one video or only images');
    }
    if (item.media.length > MAX_IMAGES) {
      throw new BadBodyError(this.identifier, `Facebook posts can have up to ${MAX_IMAGES} images`);
    }

    // Reels and feed videos use the same Page video upload; Instagram still gets a reel.
    if (videos.length === 1) {
      const { id } = await this.graph<GraphCreated>(`${target.internalId}/videos`, {
        action: 'upload video',
        token: target.accessToken,
        method: 'POST',
        host: 'graph-video.facebook.com',
        form: await this.fileForm(videos[0]),
        params: { description: item.content },
      });
      return { releaseId: id, releaseUrl: `${POST_URL}/${target.internalId}/videos/${id}` };
    }

    const attached: Record<string, string> = {};
    for (const [index, media] of item.media.entries()) {
      const { id } = await this.graph<GraphCreated>(`${target.internalId}/photos`, {
        action: 'upload photo',
        token: target.accessToken,
        method: 'POST',
        form: await this.fileForm(media),
        params: { published: false, ...(media.alt ? { alt_text_custom: media.alt } : {}) },
      });
      attached[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id });
    }

    const { id } = await this.graph<GraphCreated>(`${target.internalId}/feed`, {
      action: 'publish post',
      token: target.accessToken,
      method: 'POST',
      params: { message: item.content, ...attached },
    });
    return { releaseId: id, releaseUrl: `${POST_URL}/${id}` };
  }

  // Follow-up items become comments on the first post. Media attached to a
  // comment is not sent.
  async comment(
    target: PublishTarget,
    thread: PublishThread,
    item: PublishItem
  ): Promise<PublishResult> {
    const { id } = await this.graph<GraphCreated>(`${thread.rootReleaseId}/comments`, {
      action: 'publish comment',
      token: target.accessToken,
      method: 'POST',
      params: { message: item.content },
    });
    return { releaseId: id, releaseUrl: `${POST_URL}/${id}` };
  }

  private async publishStory(target: PublishTarget, media: PublishMedia): Promise<PublishResult> {
    if (media.type === 'video') {
      const { id } = await this.graph<GraphCreated>(`${target.internalId}/videos`, {
        action: 'upload story video',
        token: target.accessToken,
        method: 'POST',
        host: 'graph-video.facebook.com',
        form: await this.fileForm(media),
        params: { published: false },
      });
      const published = await this.graph<GraphCreated>(`${target.internalId}/video_stories`, {
        action: 'publish video story',
        token: target.accessToken,
        method: 'POST',
        params: { video_id: id },
      });
      const releaseId = published.post_id ?? published.id ?? id;
      return { releaseId, releaseUrl: `${POST_URL}/${releaseId}` };
    }

    const { id } = await this.graph<GraphCreated>(`${target.internalId}/photos`, {
      action: 'upload story photo',
      token: target.accessToken,
      method: 'POST',
      form: await this.fileForm(media),
      params: { published: false, ...(media.alt ? { alt_text_custom: media.alt } : {}) },
    });
    const published = await this.graph<GraphCreated>(`${target.internalId}/photo_stories`, {
      action: 'publish photo story',
      token: target.accessToken,
      method: 'POST',
      params: { photo_id: id },
    });
    const releaseId = published.post_id ?? published.id ?? id;
    return { releaseId, releaseUrl: `${POST_URL}/${releaseId}` };
  }

  private async fileForm(media: PublishMedia): Promise<FormData> {
    const form = new FormData();
    const fileName = new URL(media.url).pathname.split('/').pop() ?? 'upload';
    form.append(
      'source',
      new Blob([new Uint8Array(await media.read())], { type: media.mimeType }),
      fileName
    );
    return form;
  }
}
