import type { Metadata } from 'next';
import { SocialCalendar } from '@/modules/social/components/calendar/social-calendar';

export const metadata: Metadata = {
  title: 'Calendar',
};

export default function CalendarPage() {
  return <SocialCalendar />;
}
