import type { Metadata } from 'next';
import { MediaLibrary } from '@/modules/social/components/media/media-library';
import { socialSections } from '@/modules/social/config/navigation';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Media',
};

export default function MediaPage() {
  const { label, description } = socialSections.media;

  return (
    <>
      <PageHeader title={label} description={description} />
      <MediaLibrary />
    </>
  );
}
