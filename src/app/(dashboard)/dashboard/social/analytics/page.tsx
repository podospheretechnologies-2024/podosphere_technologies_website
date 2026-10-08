import type { Metadata } from 'next';
import { AnalyticsPanel } from '@/modules/social/components/analytics/analytics-panel';

import { AudiencePanel } from '@/modules/social/components/analytics/audience-panel';

export const metadata: Metadata = {
  title: 'Analytics',
};

export default async function AnalyticsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const searchParams = await props.searchParams;
  const tab = searchParams.tab || 'publishing';

  return (
    <div className="space-y-6">
      <div className="flex gap-6 border-b border-gray-200">
        <a 
          href="/dashboard/social/analytics?tab=publishing"
          className={`pb-3 font-medium text-sm transition-colors border-b-2 ${
            tab === 'publishing' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Publishing Performance
        </a>
        <a 
          href="/dashboard/social/analytics?tab=audience"
          className={`pb-3 font-medium text-sm transition-colors border-b-2 ${
            tab === 'audience' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Audience & Competitors
        </a>
      </div>

      {tab === 'publishing' ? <AnalyticsPanel /> : <AudiencePanel />}
    </div>
  );
}
