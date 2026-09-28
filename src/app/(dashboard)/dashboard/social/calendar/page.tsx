import type { Metadata } from 'next';
import { ComingSoonSection } from '@/modules/social/components/coming-soon-section';

export const metadata: Metadata = {
  title: 'Calendar',
};

export default function CalendarPage() {
  return <ComingSoonSection section="calendar" />;
}
