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
import {
  ensureInstagramPublishImage,
  isMetaPostImageMime,
} from '../../../media/ensure-instagram-jpeg';
import type { GraphPage } from './graph-client';
import { MetaProviderBase } from './meta.provider.base';

const PROFILE_URL = 'https://www.instagram.com';
const MAX_CAROUSEL_ITEMS = 10;
const CONTAINER_POLL_INTERVAL_MS = 3000;
const CONTAINER_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;
const LOCAL_HOSTS = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/;

interface GraphCreated {
  id: string;
}

interface ContainerStatus {
  status_code?: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';
  status?: string;
}

type ContainerParams = Record<string, string | boolean | undefined>;

// Instagram Business / Creator account linked to a Facebook Page. Instagram downloads
// every file from its URL, so media has to be reachable from the internet.
export class InstagramProvider extends MetaProviderBase {
  readonly identifier = 'instagram';
  readonly name = 'Instagram';
  readonly scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_comments',
    'pages_show_list',
    'pages_read_engagement',
    'business_management',
  ] as const;
  protected readonly noAccountsMessage =
    'No Instagram account was found. Link an Instagram Business or Creator account to a Facebook Page, then reconnect and select that Page.';

  maxLength() {
    return 2200;
  }

  protected toAccounts(pages: GraphPage[]): AuthTokenDetails[] {
    return pages.flatMap((page) => {
      const account = page.instagram_business_account;
      if (!account || !page.access_token) {
        return [];
      }
      return [
        {
          internalId: account.id,
          name: account.username ?? page.name,
          username: account.username,
          picture: account.profile_picture_url,
          accessToken: page.access_token,
        },
      ];
    });
  }

  async post(target: PublishTarget, item: PublishItem): Promise<PublishResult> {
    const { media: rawMedia } = item;
    if (rawMedia.length === 0) {
      throw new BadBodyError(this.identifier, 'Instagram posts need at least one image or video');
    }
    if (rawMedia.length > MAX_CAROUSEL_ITEMS) {
      throw new BadBodyError(
        this.identifier,
        `Instagram posts can have up to ${MAX_CAROUSEL_ITEMS} images or videos`
      );
    }
    rawMedia.forEach((entry) => this.assertPublishable(entry));

    // Meta's image_url publish path expects JPEG; PNG is converted first.
    const media = await Promise.all(rawMedia.map((entry) => ensureInstagramPublishImage(entry)));

    const isStory = media.some((entry) => entry.format === 'story');
    if (isStory && media.length > 1) {
      throw new BadBodyError(this.identifier, 'An Instagram story can have one image or video');
    }

    let creationId: string;
    if (media.length === 1) {
      creationId = await this.createContainer(target, {
        ...this.singleParams(media[0], isStory),
        // Stories have no caption.
        caption: isStory ? undefined : item.content,
      });
    } else {
      const children: string[] = [];
      for (const entry of media) {
        children.push(
          await this.createContainer(target, {
            ...(entry.type === 'video'
              ? { media_type: 'VIDEO', video_url: entry.url }
              : { image_url: entry.url }),
            is_carousel_item: true,
          })
        );
      }
      creationId = await this.createContainer(target, {
        media_type: 'CAROUSEL',
        children: children.join(','),
        caption: item.content,
      });
    }

    const { id } = await this.graph<GraphCreated>(`${target.internalId}/media_publish`, {
      action: 'publish post',
      token: target.accessToken,
      method: 'POST',
      params: { creation_id: creationId },
    });
    return { releaseId: id, releaseUrl: await this.permalink(target, id) };
  }

  // Follow-up items become comments on the first post. Comments are text only.
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
    return { releaseId: id, releaseUrl: await this.permalink(target, thread.rootReleaseId) };
  }

  private assertPublishable(media: PublishMedia) {
    if (media.type === 'image' && !isMetaPostImageMime(media.mimeType)) {
      throw new BadBodyError(
        this.identifier,
        'Instagram posts accept JPEG or PNG images (PNG is converted to JPEG automatically)'
      );
    }
    if (LOCAL_HOSTS.test(new URL(media.url).hostname)) {
      throw new BadBodyError(
        this.identifier,
        'Instagram downloads media from a public URL and cannot reach this computer. Set APP_URL to a public address (e.g. an ngrok tunnel).'
      );
    }
  }

  // Every feed video is published as a reel; the story format posts to the story.
  private singleParams(media: PublishMedia, isStory: boolean): ContainerParams {
    const source = media.type === 'video' ? { video_url: media.url } : { image_url: media.url };
    if (isStory) {
      return { ...source, media_type: 'STORIES' };
    }
    if (media.type === 'video') {
      return { ...source, media_type: 'REELS', share_to_feed: true };
    }
    return source;
  }

  // Instagram processes containers asynchronously and rejects publishing one that
  // is not finished yet.
  private async createContainer(target: PublishTarget, params: ContainerParams): Promise<string> {
    const { id } = await this.graph<GraphCreated>(`${target.internalId}/media`, {
      action: 'upload media',
      token: target.accessToken,
      method: 'POST',
      params,
    });

    const deadline = Date.now() + CONTAINER_PROCESSING_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const { status_code, status } = await this.graph<ContainerStatus>(id, {
        action: 'check media status',
        token: target.accessToken,
        params: { fields: 'status_code,status' },
      });
      if (status_code === 'FINISHED') {
        return id;
      }
      if (status_code === 'ERROR' || status_code === 'EXPIRED') {
        throw new BadBodyError(
          this.identifier,
          `Instagram could not process the media${status ? ` (${status})` : ''}`
        );
      }
      await this.wait(CONTAINER_POLL_INTERVAL_MS);
    }

    throw new BadBodyError(this.identifier, 'Instagram took too long to process the media');
  }

  private async permalink(target: PublishTarget, mediaId: string): Promise<string> {
    const { permalink } = await this.graph<{ permalink?: string }>(mediaId, {
      action: 'load post link',
      token: target.accessToken,
      params: { fields: 'permalink' },
    });
    return permalink ?? PROFILE_URL;
  }
}
