import type { Metadata } from 'next';
import { AnalyticsPanel } from '@/modules/social/components/analytics/analytics-panel';

export const metadata: Metadata = {
  title: 'Analytics',
};

export default function AnalyticsPage() {
  return <AnalyticsPanel />;
}
