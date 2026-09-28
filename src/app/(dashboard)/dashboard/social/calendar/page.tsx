import type { Metadata } from 'next';
import { SocialCalendar } from '@/modules/social/components/calendar/social-calendar';
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
      <SocialCalendar />
    </>
  );
}
