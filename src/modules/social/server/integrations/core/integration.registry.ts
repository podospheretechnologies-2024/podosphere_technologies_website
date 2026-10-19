import 'server-only';
import { GoogleBusinessProvider, YouTubeProvider } from '../providers/google/google.provider';
import { LinkedInProvider } from '../providers/linkedin/linkedin.provider';
import { FacebookProvider } from '../providers/meta/facebook.provider';
import { InstagramProvider } from '../providers/meta/instagram.provider';
import { ThreadsProvider } from '../providers/meta/threads.provider';
import { PinterestProvider } from '../providers/pinterest/pinterest.provider';
import type { SocialProvider } from './social-provider.interface';

// Add new channels here; the rest of the module discovers them automatically.
const providers: readonly SocialProvider[] = [
  new LinkedInProvider(),
  new FacebookProvider(),
  new InstagramProvider(),
  new ThreadsProvider(),
  new YouTubeProvider(),
  new GoogleBusinessProvider(),
  new PinterestProvider(),
];

const providersByIdentifier = new Map(providers.map((provider) => [provider.identifier, provider]));

export const integrationRegistry = {
  list(): readonly SocialProvider[] {
    return providers;
  },

  get(identifier: string): SocialProvider | undefined {
    return providersByIdentifier.get(identifier);
  },
};
