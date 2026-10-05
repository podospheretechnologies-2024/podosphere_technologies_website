'use client';

import dayjs from 'dayjs';
import { Mail, Phone, User, X } from 'lucide-react';
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

const CONTACT_FIELD_KEYS = new Set([
  'full_name',
  'full name',
  'name',
  'first_name',
  'last_name',
  'phone_number',
  'phone',
  'email',
  'work_email',
  'company_name',
  'company',
  'website',
]);

function money(value: number, currency: string, digits = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Turn snake_case / question keys into readable labels. */
function humanizeLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'Field';
  const withoutPunctuation = trimmed.replace(/\?+$/, '');
  return withoutPunctuation
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Clean underscore-heavy answer values for display. */
function humanizeValue(raw: string): string {
  const text = raw.trim();
  if (!text) return '—';
  if (text.includes('@') || text.startsWith('http') || /^\+?\d[\d\s-]{6,}$/.test(text)) {
    return text;
  }
  return text
    .split(/[,|]/)
    .map((part) =>
      part
        .trim()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
    )
    .filter(Boolean)
    .join(', ');
}

function fieldKey(name: string) {
  return name.trim().toLowerCase().replace(/\?+$/, '');
}

function isContactField(name: string) {
  const key = fieldKey(name);
  if (CONTACT_FIELD_KEYS.has(key)) return true;
  return /name|phone|email|company|website|mobile/.test(key);
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-border bg-surface rounded-xl border px-3.5 py-3', className)}>
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <div className="text-foreground mt-1.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
        {value === null || value === undefined || value === '' ? '—' : value}
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-muted/50 min-w-0 flex-1 rounded-xl px-3 py-2.5 text-center">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <p className="text-foreground mt-1 text-sm font-semibold tabular-nums">{value}</p>
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

function LeadCard({ lead }: { lead: AdsLeadItem }) {
  const contact = lead.fields.filter((field) => isContactField(field.name));
  const survey = lead.fields.filter((field) => !isContactField(field.name));

  const nameField = contact.find((field) => /name/.test(fieldKey(field.name)));
  const phoneField = contact.find((field) => /phone|mobile/.test(fieldKey(field.name)));
  const emailField = contact.find((field) => /email/.test(fieldKey(field.name)));
  const companyField = contact.find((field) => /company/.test(fieldKey(field.name)));

  const displayName = nameField?.values[0]
    ? humanizeValue(nameField.values[0])
    : 'Lead';

  return (
    <li className="border-border bg-surface overflow-hidden rounded-2xl border shadow-sm">
      <div className="border-border flex flex-wrap items-start justify-between gap-2 border-b bg-[#F7F8FA] px-4 py-3">
        <div className="min-w-0">
          <p className="text-foreground flex items-center gap-1.5 text-sm font-semibold">
            <User className="text-primary size-3.5 shrink-0" />
            <span className="truncate">{displayName}</span>
          </p>
          {companyField?.values[0] && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {humanizeValue(companyField.values[0])}
            </p>
          )}
        </div>
        <p className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
          {lead.createdTime ? dayjs(lead.createdTime).format('D MMM · h:mm A') : '—'}
        </p>
      </div>

      <div className="space-y-3 px-4 py-3">
        {(phoneField || emailField) && (
          <div className="flex flex-wrap gap-2">
            {phoneField?.values[0] && (
              <a
                href={`tel:${phoneField.values[0].replace(/\s/g, '')}`}
                className="bg-primary/8 text-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              >
                <Phone className="size-3" />
                {phoneField.values[0]}
              </a>
            )}
            {emailField?.values[0] && (
              <a
                href={`mailto:${emailField.values[0]}`}
                className="bg-primary/8 text-foreground inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs font-medium"
              >
                <Mail className="size-3 shrink-0" />
                <span className="truncate">{emailField.values[0]}</span>
              </a>
            )}
          </div>
        )}

        {survey.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {survey.map((field) => (
              <div
                key={`${lead.id}-${field.name}`}
                className="bg-surface-muted/40 rounded-xl px-3 py-2.5"
              >
                <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                  {humanizeLabel(field.name)}
                </p>
                <p className="text-foreground mt-1 text-xs leading-relaxed">
                  {field.values.map(humanizeValue).join(', ')}
                </p>
              </div>
            ))}
          </div>
        )}

        {contact
          .filter(
            (field) =>
              field !== nameField &&
              field !== phoneField &&
              field !== emailField &&
              field !== companyField
          )
          .map((field) => (
            <div key={`${lead.id}-${field.name}`} className="text-xs">
              <span className="text-muted-foreground">{humanizeLabel(field.name)}: </span>
              <span className="text-foreground font-medium">
                {field.values.map(humanizeValue).join(', ')}
              </span>
            </div>
          ))}
      </div>
    </li>
  );
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
            {subtitle && <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{subtitle}</p>}
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
                  Totals for the selected date range from Meta.
                </p>
              </div>
              {history.isLoading && (
                <p className="text-muted-foreground text-sm">Loading period totals…</p>
              )}
              {history.error && (
                <p className="text-danger text-sm">{history.error.message}</p>
              )}
              {history.data && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricChip label="Spend" value={money(history.data.totals.spend, currency)} />
                  <MetricChip
                    label="Impressions"
                    value={count.format(history.data.totals.impressions)}
                  />
                  <MetricChip label="Clicks" value={count.format(history.data.totals.clicks)} />
                  <MetricChip label="Leads" value={count.format(history.data.totals.leads)} />
                  <MetricChip label="CTR" value={`${history.data.totals.ctr.toFixed(2)}%`} />
                  <MetricChip
                    label="CPC"
                    value={
                      history.data.totals.cpc
                        ? money(history.data.totals.cpc, currency, 2)
                        : '—'
                    }
                  />
                  <MetricChip label="Reach" value={count.format(history.data.totals.reach)} />
                  <MetricChip
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
                <h3 className="text-sm font-semibold">Daily history</h3>
                <p className="text-muted-foreground text-xs">Day-by-day for the selected range.</p>
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
                        <th className="px-3 py-2.5 font-semibold">Date</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Spend</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Clicks</th>
                        <th className="px-3 py-2.5 text-right font-semibold">CTR</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Leads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.data.history.map((point) => (
                        <tr key={point.date} className="border-border hover:bg-surface-muted/30 border-t">
                          <td className="px-3 py-2.5 tabular-nums">
                            {dayjs(point.date).format('D MMM YYYY')}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {money(point.spend, currency, 2)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {count.format(point.clicks)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {point.ctr.toFixed(2)}%
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
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
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Leads</h3>
                  <p className="text-muted-foreground text-xs">
                    {relatedLeads.length} lead{relatedLeads.length === 1 ? '' : 's'} from this ad
                  </p>
                </div>
              </div>
              <ul className="space-y-3">
                {relatedLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
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
  const live = ad.status === 'ACTIVE';
  return (
    <section className="space-y-4">
      <div className="border-border relative overflow-hidden rounded-2xl border">
        <div className="bg-surface-muted aspect-[1.91/1]">
          {ad.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
              No creative preview
            </div>
          )}
        </div>
        <span
          className={cn(
            'absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow',
            live ? 'bg-success' : 'bg-muted-foreground'
          )}
        >
          {live ? 'Live' : ad.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <MetricChip label="Spend" value={money(ad.spend, currency)} />
        <MetricChip label="Leads" value={count.format(ad.leads)} />
        <MetricChip
          label="Cost / lead"
          value={ad.costPerLead === null ? '—' : money(ad.costPerLead, currency)}
        />
        <MetricChip label="CTR" value={`${ad.ctr.toFixed(2)}%`} />
      </div>

      {(ad.headline || ad.description || ad.primaryText) && (
        <div className="border-border space-y-3 rounded-2xl border p-4">
          {ad.headline && (
            <div>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Headline
              </p>
              <p className="text-foreground mt-1 text-sm font-semibold leading-snug">{ad.headline}</p>
            </div>
          )}
          {ad.description && (
            <div>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Description
              </p>
              <p className="text-foreground mt-1 text-sm leading-relaxed">{ad.description}</p>
            </div>
          )}
          {ad.primaryText && (
            <div>
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Primary text
              </p>
              <p className="text-foreground mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                {ad.primaryText}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Campaign" value={ad.campaignName} />
        <Field label="Ad set" value={ad.adsetName} />
        <Field label="Impressions" value={count.format(ad.impressions)} />
        <Field label="Clicks" value={count.format(ad.clicks)} />
        <Field label="CPC" value={ad.cpc ? money(ad.cpc, currency, 2) : '—'} />
        <Field label="Ad ID" value={<span className="font-mono text-xs">{ad.id}</span>} />
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
      <div className="flex flex-wrap gap-2">
        <MetricChip label="Spend" value={money(campaign.spend, currency)} />
        <MetricChip label="Leads" value={count.format(campaign.leads)} />
        <MetricChip label="Impressions" value={count.format(campaign.impressions)} />
        <MetricChip label="CTR" value={`${campaign.ctr.toFixed(2)}%`} />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Status" value={campaign.status.replace(/_/g, ' ')} />
        <Field
          label="Objective"
          value={campaign.objective.replace(/^OUTCOME_/, '').replace(/_/g, ' ')}
        />
        <Field label="Budget" value={campaign.budgetLabel ?? 'Ad set budget'} />
        <Field
          label="Cost / lead"
          value={
            campaign.costPerLead === null ? '—' : money(campaign.costPerLead, currency)
          }
        />
        <Field label="Clicks" value={count.format(campaign.clicks)} />
        <Field label="Landing page views" value={count.format(campaign.landingPageViews)} />
        <Field label="Campaign ID" value={<span className="font-mono text-xs">{campaign.id}</span>} />
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
      <div className="flex flex-wrap gap-2">
        <MetricChip label="Spend" value={money(adset.spend, currency)} />
        <MetricChip label="Leads" value={count.format(adset.leads)} />
        <MetricChip
          label="Cost / lead"
          value={adset.costPerLead === null ? '—' : money(adset.costPerLead, currency)}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Status" value={adset.status.replace(/_/g, ' ')} />
        <Field label="Campaign" value={adset.campaignName} />
        <Field label="Age" value={age} />
        <Field label="Locations" value={adset.targeting.locations.join(', ') || '—'} />
        <Field label="Interests" value={adset.targeting.interests.join(', ') || '—'} />
        <Field label="Behaviors" value={adset.targeting.behaviors.join(', ') || '—'} />
        <Field label="Ad set ID" value={<span className="font-mono text-xs">{adset.id}</span>} />
      </div>
    </section>
  );
}

function LeadDetails({ lead }: { lead: AdsLeadItem }) {
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field
          label="Created"
          value={
            lead.createdTime ? dayjs(lead.createdTime).format('D MMM YYYY · h:mm A') : '—'
          }
        />
        <Field label="Ad" value={lead.adName} />
        <Field label="Ad set" value={lead.adsetName} />
        <Field label="Campaign" value={lead.campaignName} />
      </div>
      <LeadCard lead={lead} />
    </section>
  );
}
