import type { Metadata } from 'next';
import { getCurrentUser } from '@/modules/auth/server/session';
import { MediaLibrary } from '@/modules/social/components/media/media-library';

export const metadata: Metadata = {
  title: 'Media',
};

export default async function MediaPage() {
  const user = await getCurrentUser();
  return <MediaLibrary accountName={user?.organization.name ?? 'podosphere'} />;
}
