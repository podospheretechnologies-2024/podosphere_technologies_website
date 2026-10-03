import type { Metadata } from 'next';
import { AdsDashboard } from '@/modules/social/components/ads/ads-dashboard';

export const metadata: Metadata = {
  title: 'Ads',
};

export default function AdsPage() {
  return <AdsDashboard />;
}
