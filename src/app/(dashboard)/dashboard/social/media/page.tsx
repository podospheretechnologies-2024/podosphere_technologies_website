import type { Metadata } from 'next';
import { getCurrentUser } from '@/modules/auth/server/session';
import { MediaLibrary } from '@/modules/social/components/media/media-library';
import { socialSections } from '@/modules/social/config/navigation';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Media',
};

export default async function MediaPage() {
  const { label, description } = socialSections.media;
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader title={label} description={description} />
      <MediaLibrary accountName={user?.organization.name ?? 'podosphere'} />
    </>
  );
}
