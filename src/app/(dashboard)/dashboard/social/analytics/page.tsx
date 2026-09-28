import type { Metadata } from 'next';
import { ComingSoonSection } from '@/modules/social/components/coming-soon-section';

export const metadata: Metadata = {
  title: 'Analytics',
};

export default function AnalyticsPage() {
  return <ComingSoonSection section="analytics" />;
}
