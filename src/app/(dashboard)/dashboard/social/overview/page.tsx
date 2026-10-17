import type { Metadata } from 'next';
import { AgencyOverviewPanel } from '@/modules/social/components/overview/agency-overview';

export const metadata: Metadata = {
  title: 'Overview',
};

export default function SocialOverviewPage() {
  return <AgencyOverviewPanel />;
}
