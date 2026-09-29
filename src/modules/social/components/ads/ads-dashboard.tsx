'use client';

import { useState } from 'react';
import { Card } from '@/shared/components/ui/card';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { SegmentedControl } from '@/shared/components/ui/segmented-control';
import { cn } from '@/shared/lib/cn';
import { ADS_DATE_PRESETS, ADS_DEFAULT_DATE_PRESET, type AdsDatePreset } from '../../config/ads';
import { useAdAccounts, useAdsOverview } from '../../hooks/use-ads';
import type { AdAccountItem, AdsDailyPoint, AdsOverview } from '../../types/ads';

const count = new Intl.NumberFormat('en-IN');

function money(value: number, currency: string, digits = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: digits,
  }).format(value);
}

function preferredAccount(accounts: AdAccountItem[]): string | null {
  const own = accounts.find((account) => /podosphere/i.test(account.name));
  return (own ?? accounts[0])?.id ?? null;
}

export function AdsDashboard() {
  const accountsQuery = useAdAccounts();
  const [selected, setSelected] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<AdsDatePreset>(ADS_DEFAULT_DATE_PRESET);

  const accounts = accountsQuery.data?.accounts ?? [];
  const accountId = selected ?? preferredAccount(accounts);
  const overview = useAdsOverview(accountId, datePreset);

  if (accountsQuery.isLoading) {
    return <Card className="text-muted-foreground text-sm">Loading ad accounts…</Card>;
  }
  if (accountsQuery.error) {
    return <Card className="text-danger text-sm">{accountsQuery.error.message}</Card>;
  }
  if (!accountsQuery.data?.configured) {
    return (
      <EmptyState
        title="Ads are not connected yet"
        description="Create a system user in Meta Business Manager with ads_read on your ad accounts, then set META_SYSTEM_USER_TOKEN on the server."
      />
    );
  }
  if (accounts.length === 0) {
    return (
      <EmptyState
        title="No ad accounts shared"
        description="In Business Manager → System users → podo-social-bot → Assign assets, add the ad accounts you want to see here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Ad account</span>
          <select
            className="border-border bg-surface h-10 rounded-lg border px-3 text-sm"
            value={accountId ?? ''}
            onChange={(event) => setSelected(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.id.replace('act_', '')})
                {account.status !== 1 ? ' · inactive' : ''}
              </option>
            ))}
          </select>
        </label>
        <SegmentedControl
          label="Date range"
          options={ADS_DATE_PRESETS}
          value={datePreset}
          onChange={setDatePreset}
        />
      </div>

      {overview.error && <Card className="text-danger text-sm">{overview.error.message}</Card>}
      {!overview.data && !overview.error && (
        <Card className="text-muted-foreground text-sm">Loading live data from Meta…</Card>
      )}
      {overview.data && (
        <div className={cn('space-y-6 transition', overview.isValidating && 'opacity-60')}>
          <Totals data={overview.data} />
          <DailySpend points={overview.data.daily} currency={overview.data.account.currency} />
          <Campaigns data={overview.data} />
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Read-only view from the Meta Marketing API. Campaigns can&apos;t be paused or edited from here.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}

function Totals({ data }: { data: AdsOverview }) {
  const { totals, account } = data;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Spend" value={money(totals.spend, account.currency)} />
      <Stat label="Impressions" value={count.format(totals.impressions)} />
      <Stat label="Reach" value={count.format(totals.reach)} />
      <Stat label="Clicks" value={count.format(totals.clicks)} />
      <Stat label="CTR" value={`${totals.ctr.toFixed(2)}%`} />
      <Stat label="Cost per click" value={money(totals.cpc, account.currency, 2)} />
      <Stat label="Leads" value={count.format(totals.leads)} />
      <Stat
        label="Cost per lead"
        value={totals.costPerLead === null ? '—' : money(totals.costPerLead, account.currency)}
      />
    </div>
  );
}

function DailySpend({ points, currency }: { points: AdsDailyPoint[]; currency: string }) {
  const max = Math.max(...points.map((point) => point.spend), 0);
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold">Daily spend</h2>
      {max === 0 ? (
        <p className="text-muted-foreground text-sm">No spend in this period.</p>
      ) : (
        <div className="flex h-40 items-end gap-1">
          {points.map((point) => (
            <div
              key={point.date}
              className="bg-primary/80 hover:bg-primary min-w-1 flex-1 rounded-t transition"
              style={{ height: `${Math.max((point.spend / max) * 100, 2)}%` }}
              title={`${point.date}: ${money(point.spend, currency)} · ${count.format(point.clicks)} clicks`}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function Campaigns({ data }: { data: AdsOverview }) {
  const { campaigns, account } = data;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-border text-muted-foreground border-b text-left text-xs">
          <tr>
            <th className="px-4 py-3 font-medium">Campaign</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Spend</th>
            <th className="px-4 py-3 text-right font-medium">Clicks</th>
            <th className="px-4 py-3 text-right font-medium">CTR</th>
            <th className="px-4 py-3 text-right font-medium">Leads</th>
            <th className="px-4 py-3 text-right font-medium">Cost / lead</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="border-border border-b last:border-0">
              <td className="px-4 py-3">
                <p className="font-medium">{campaign.name}</p>
                <p className="text-muted-foreground text-xs">
                  {campaign.objective.replace('OUTCOME_', '').toLowerCase()}
                </p>
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    campaign.status === 'ACTIVE'
                      ? 'bg-success/15 text-success'
                      : 'bg-surface-muted text-muted-foreground'
                  )}
                >
                  {campaign.status === 'ACTIVE' ? 'Live' : campaign.status.toLowerCase().replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-4 py-3 text-right">{money(campaign.spend, account.currency)}</td>
              <td className="px-4 py-3 text-right">{count.format(campaign.clicks)}</td>
              <td className="px-4 py-3 text-right">{campaign.ctr.toFixed(2)}%</td>
              <td className="px-4 py-3 text-right">{count.format(campaign.leads)}</td>
              <td className="px-4 py-3 text-right">
                {campaign.costPerLead === null ? '—' : money(campaign.costPerLead, account.currency)}
              </td>
            </tr>
          ))}
          {campaigns.length === 0 && (
            <tr>
              <td colSpan={7} className="text-muted-foreground px-4 py-6 text-center">
                No campaigns in this ad account.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
