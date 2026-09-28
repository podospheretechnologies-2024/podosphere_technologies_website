import type { Metadata } from 'next';
import { PostsList } from '@/modules/social/components/posts/posts-list';
import { socialSections } from '@/modules/social/config/navigation';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Calendar',
};

export default function CalendarPage() {
  const { label, description } = socialSections.calendar;

  return (
    <>
      <PageHeader title={label} description={description} />
      <PostsList />
    </>
  );
}
