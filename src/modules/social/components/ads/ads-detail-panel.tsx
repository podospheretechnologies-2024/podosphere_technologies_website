'use client';

import dayjs from 'dayjs';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { useAdsEntityHistory, type AdsOverviewDateInput } from '../../hooks/use-ads';
import type {
  AdsAdItem,
  AdsAdSetItem,
  AdsCampaignItem,
  AdsLeadItem,
  AdsLiveAd,
} from '../../types/ads';

const count = new Intl.NumberFormat('en-IN');

function money(value: number, currency: string, digits = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: digits,
  }).format(value);
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-border bg-surface-muted/30 rounded-xl border px-3 py-2.5">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="text-foreground mt-1 text-sm break-words whitespace-pre-wrap">
        {value === null || value === undefined || value === '' ? '—' : value}
      </div>
    </div>
  );
}

export type AdsDetailSelection =
  | { kind: 'ad'; ad: AdsAdItem | AdsLiveAd }
  | { kind: 'campaign'; campaign: AdsCampaignItem }
  | { kind: 'adset'; adset: AdsAdSetItem }
  | { kind: 'lead'; lead: AdsLeadItem };

function asAdItem(ad: AdsAdItem | AdsLiveAd): AdsAdItem {
  if ('primaryText' in ad) return ad;
  return {
    id: ad.id,
    name: ad.name,
    status: ad.status,
    campaignId: ad.campaignId,
    campaignName: ad.campaignName,
    adsetId: ad.adsetId,
    adsetName: ad.adsetName,
    thumbnailUrl: ad.thumbnailUrl,
    primaryText: ad.body,
    headline: ad.headline,
    description: null,
    spend: ad.spend,
    impressions: ad.impressions,
    clicks: ad.clicks,
    ctr: ad.ctr,
    cpc: 0,
    leads: ad.leads,
    costPerLead: ad.costPerLead,
  };
}

export function AdsDetailPanel({
  selection,
  currency,
  accountId,
  date,
  relatedLeads,
  onClose,
}: {
  selection: AdsDetailSelection;
  currency: string;
  accountId: string;
  date: AdsOverviewDateInput;
  relatedLeads: AdsLeadItem[];
  onClose: () => void;
}) {
  const historyKind =
    selection.kind === 'lead' ? null : selection.kind === 'ad' ? 'ad' : selection.kind;
  const historyId =
    selection.kind === 'ad'
      ? selection.ad.id
      : selection.kind === 'campaign'
        ? selection.campaign.id
        : selection.kind === 'adset'
          ? selection.adset.id
          : null;

  const history = useAdsEntityHistory(accountId, historyKind, historyId, date);

  const title =
    selection.kind === 'ad'
      ? selection.ad.name
      : selection.kind === 'campaign'
        ? selection.campaign.name
        : selection.kind === 'adset'
          ? selection.adset.name
          : 'Lead details';

  const subtitle =
    selection.kind === 'ad'
      ? [selection.ad.campaignName, selection.ad.adsetName].filter(Boolean).join(' · ')
      : selection.kind === 'campaign'
        ? selection.campaign.objective.replace(/^OUTCOME_/, '').replace(/_/g, ' ')
        : selection.kind === 'adset'
          ? selection.adset.campaignName
          : selection.lead.adName;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 p-0 sm:p-4" role="dialog">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <aside className="border-border bg-surface relative flex h-full w-full max-w-xl flex-col overflow-hidden border shadow-2xl sm:rounded-2xl">
        <header className="border-border flex items-start gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              {selection.kind === 'ad'
                ? 'Ad details'
                : selection.kind === 'campaign'
                  ? 'Campaign details'
                  : selection.kind === 'adset'
                    ? 'Ad set details'
                    : 'Lead details'}
            </p>
            <h2 className="text-foreground mt-1 text-lg font-semibold leading-snug">{title}</h2>
            {subtitle && <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={onClose} aria-label="Close details">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {selection.kind === 'ad' && (
            <AdDetails ad={asAdItem(selection.ad)} currency={currency} />
          )}
          {selection.kind === 'campaign' && (
            <CampaignDetails campaign={selection.campaign} currency={currency} />
          )}
          {selection.kind === 'adset' && (
            <AdSetDetails adset={selection.adset} currency={currency} />
          )}
          {selection.kind === 'lead' && <LeadDetails lead={selection.lead} />}

          {selection.kind !== 'lead' && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Current period</h3>
                <p className="text-muted-foreground text-xs">
                  Totals for the selected date range (from Meta insights).
                </p>
              </div>
              {history.isLoading && (
                <p className="text-muted-foreground text-sm">Loading period totals…</p>
              )}
              {history.error && (
                <p className="text-danger text-sm">{history.error.message}</p>
              )}
              {history.data && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Spend" value={money(history.data.totals.spend, currency)} />
                  <Field
                    label="Impressions"
                    value={count.format(history.data.totals.impressions)}
                  />
                  <Field label="Reach" value={count.format(history.data.totals.reach)} />
                  <Field label="Clicks" value={count.format(history.data.totals.clicks)} />
                  <Field label="CTR" value={`${history.data.totals.ctr.toFixed(2)}%`} />
                  <Field
                    label="CPC"
                    value={
                      history.data.totals.cpc
                        ? money(history.data.totals.cpc, currency, 2)
                        : '—'
                    }
                  />
                  <Field label="Leads" value={count.format(history.data.totals.leads)} />
                  <Field
                    label="Cost / lead"
                    value={
                      history.data.totals.costPerLead === null
                        ? '—'
                        : money(history.data.totals.costPerLead, currency)
                    }
                  />
                </div>
              )}
            </section>
          )}

          {selection.kind !== 'lead' && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Historical daily data</h3>
                <p className="text-muted-foreground text-xs">
                  Day-by-day performance for the selected range.
                </p>
              </div>
              {history.isLoading && (
                <p className="text-muted-foreground text-sm">Loading history…</p>
              )}
              {history.data && history.data.history.length === 0 && (
                <p className="text-muted-foreground text-sm">No daily rows for this period.</p>
              )}
              {history.data && history.data.history.length > 0 && (
                <div className="border-border overflow-hidden rounded-xl border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted/60 text-muted-foreground tracking-wide uppercase">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 text-right font-semibold">Spend</th>
                        <th className="px-3 py-2 text-right font-semibold">Clicks</th>
                        <th className="px-3 py-2 text-right font-semibold">CTR</th>
                        <th className="px-3 py-2 text-right font-semibold">Leads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.data.history.map((point) => (
                        <tr key={point.date} className="border-border border-t">
                          <td className="px-3 py-2 tabular-nums">
                            {dayjs(point.date).format('D MMM YYYY')}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {money(point.spend, currency, 2)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {count.format(point.clicks)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {point.ctr.toFixed(2)}%
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {count.format(point.leads)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {selection.kind === 'ad' && relatedLeads.length > 0 && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Leads for this ad</h3>
                <p className="text-muted-foreground text-xs">
                  {relatedLeads.length} lead{relatedLeads.length === 1 ? '' : 's'} retrieved
                </p>
              </div>
              <ul className="space-y-2">
                {relatedLeads.map((lead) => (
                  <li
                    key={lead.id}
                    className="border-border bg-surface-muted/25 rounded-xl border px-3 py-2.5 text-xs"
                  >
                    <p className="font-medium">
                      {lead.createdTime
                        ? dayjs(lead.createdTime).format('D MMM YYYY · h:mm A')
                        : '—'}
                    </p>
                    <ul className="text-muted-foreground mt-1.5 space-y-0.5">
                      {lead.fields.map((field) => (
                        <li key={`${lead.id}-${field.name}`}>
                          <span className="text-foreground font-medium">{field.name}</span>
                          {' · '}
                          {field.values.join(', ')}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function AdDetails({ ad, currency }: { ad: AdsAdItem; currency: string }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Creative & placement</h3>
      <div className="border-border bg-surface-muted relative aspect-[1.91/1] overflow-hidden rounded-xl border">
        {ad.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            No creative preview
          </div>
        )}
        <span
          className={cn(
            'absolute top-2.5 left-2.5 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white',
            ad.status === 'ACTIVE' ? 'bg-success' : 'bg-muted-foreground'
          )}
        >
          {ad.status === 'ACTIVE' ? 'Live' : ad.status.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Ad id" value={ad.id} />
        <Field label="Status" value={ad.status} />
        <Field label="Campaign" value={ad.campaignName} />
        <Field label="Ad set" value={ad.adsetName} />
        <Field label="Headline" value={ad.headline} />
        <Field label="Description" value={ad.description} />
        <div className="sm:col-span-2">
          <Field label="Primary text" value={ad.primaryText} />
        </div>
        <Field label="Spend (list)" value={money(ad.spend, currency)} />
        <Field label="Impressions" value={count.format(ad.impressions)} />
        <Field label="Clicks" value={count.format(ad.clicks)} />
        <Field label="CTR" value={`${ad.ctr.toFixed(2)}%`} />
        <Field label="CPC" value={ad.cpc ? money(ad.cpc, currency, 2) : '—'} />
        <Field label="Leads" value={count.format(ad.leads)} />
        <Field
          label="Cost / lead"
          value={ad.costPerLead === null ? '—' : money(ad.costPerLead, currency)}
        />
      </div>
    </section>
  );
}

function CampaignDetails({
  campaign,
  currency,
}: {
  campaign: AdsCampaignItem;
  currency: string;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Campaign</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Campaign id" value={campaign.id} />
        <Field label="Status" value={campaign.status} />
        <Field label="Objective" value={campaign.objective} />
        <Field label="Budget" value={campaign.budgetLabel ?? 'Ad set budget'} />
        <Field label="Spend" value={money(campaign.spend, currency)} />
        <Field label="Impressions" value={count.format(campaign.impressions)} />
        <Field label="Clicks" value={count.format(campaign.clicks)} />
        <Field label="CTR" value={`${campaign.ctr.toFixed(2)}%`} />
        <Field
          label="CPC"
          value={campaign.cpc ? money(campaign.cpc, currency, 2) : '—'}
        />
        <Field label="Leads" value={count.format(campaign.leads)} />
        <Field
          label="Cost / lead"
          value={
            campaign.costPerLead === null ? '—' : money(campaign.costPerLead, currency)
          }
        />
        <Field label="Landing page views" value={count.format(campaign.landingPageViews)} />
      </div>
    </section>
  );
}

function AdSetDetails({ adset, currency }: { adset: AdsAdSetItem; currency: string }) {
  const age =
    adset.targeting.ageMin !== null || adset.targeting.ageMax !== null
      ? `${adset.targeting.ageMin ?? '—'}–${adset.targeting.ageMax ?? '—'}`
      : '—';
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Ad set</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Ad set id" value={adset.id} />
        <Field label="Status" value={adset.status} />
        <Field label="Campaign" value={adset.campaignName} />
        <Field label="Age" value={age} />
        <Field label="Locations" value={adset.targeting.locations.join(', ') || '—'} />
        <Field label="Interests" value={adset.targeting.interests.join(', ') || '—'} />
        <div className="sm:col-span-2">
          <Field label="Behaviors" value={adset.targeting.behaviors.join(', ') || '—'} />
        </div>
        <Field label="Spend" value={money(adset.spend, currency)} />
        <Field label="Leads" value={count.format(adset.leads)} />
        <Field
          label="Cost / lead"
          value={adset.costPerLead === null ? '—' : money(adset.costPerLead, currency)}
        />
      </div>
    </section>
  );
}

function LeadDetails({ lead }: { lead: AdsLeadItem }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Lead</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Lead id" value={lead.id} />
        <Field
          label="Created"
          value={
            lead.createdTime ? dayjs(lead.createdTime).format('D MMM YYYY · h:mm A') : '—'
          }
        />
        <Field label="Ad" value={lead.adName} />
        <Field label="Ad set" value={lead.adsetName} />
        <Field label="Campaign" value={lead.campaignName} />
        <Field label="Form id" value={lead.formId} />
      </div>
      <div className="space-y-2">
        <h4 className="text-xs font-semibold tracking-wide uppercase">Form answers</h4>
        {lead.fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">No form fields.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {lead.fields.map((field) => (
              <Field key={field.name} label={field.name} value={field.values.join(', ')} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
