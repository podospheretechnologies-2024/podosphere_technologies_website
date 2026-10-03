'use client';

import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type RowSelectionState,
} from '@tanstack/react-table';
import {
  Calendar,
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Columns3,
  Copy,
  CreditCard,
  FlaskConical,
  Folder,
  Gauge,
  GripVertical,
  Home,
  LayoutGrid,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import {
  ADS_DATE_PRESETS,
  matchesAdsStatusFilter,
  type AdsDatePreset,
  type AdsStatusFilter,
} from '../../config/ads';
import type {
  AdAccountItem,
  AdsAdItem,
  AdsAdSetItem,
  AdsCampaignItem,
  AdsOverview,
} from '../../types/ads';
import type { AdsDetailSelection } from './ads-detail-panel';

const META_BLUE = '#1877F2';
const META_GREEN = '#42B72A';
const ADS_PAGE_SIZE = 6;
const EMPTY_ROWS: ManagerRow[] = [];

const META_NAV = [
  { label: 'Account overview', active: false },
  { label: 'Campaigns', active: true },
  { label: 'Ads Reporting', active: false },
  { label: 'Audiences', active: false },
  { label: 'Advertising settings', active: false },
  { label: 'Billing and payments', active: false },
  { label: 'Events Manager', active: false },
  { label: 'All tools', active: false },
] as const;

const features = tableFeatures({
  rowSelectionFeature,
  rowSortingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

type ManagerLevel = 'campaigns' | 'adsets' | 'ads';

type ManagerRow = {
  id: string;
  level: ManagerLevel;
  name: string;
  status: string;
  deliveryLabel: string;
  recommendations: number;
  results: number;
  resultsLabel: string;
  costPerResult: number | null;
  budgetLabel: string | null;
  spend: number;
  impressions: number | null;
  reach: number | null;
  endsLabel: string;
  thumbnailUrl: string | null;
  campaignId: string | null;
  adsetId: string | null;
  subtitle: string | null;
  /** Original entity for detail panel */
  campaign?: AdsCampaignItem;
  adset?: AdsAdSetItem;
  ad?: AdsAdItem;
};

type MetricColumnId =
  | 'delivery'
  | 'actions'
  | 'results'
  | 'costPerResult'
  | 'budget'
  | 'spend'
  | 'impressions'
  | 'reach'
  | 'ends'
  | 'schedule'
  | 'attribution'
  | 'bidStrategy'
  | 'resultsRoas'
  | 'clicks'
  | 'ctr'
  | 'cpc'
  | 'linkClicks'
  | 'cpm'
  | 'frequency'
  | 'landingPageViews';

const METRIC_COLUMNS: {
  id: MetricColumnId;
  label: string;
  category: 'Key metrics' | 'Supporting metrics' | 'Ad settings';
  section: string;
  defaultVisible: boolean;
  levelHint?: string;
}[] = [
  { id: 'delivery', label: 'Delivery', category: 'Ad settings', section: 'Ad settings', defaultVisible: true },
  { id: 'actions', label: 'Actions', category: 'Ad settings', section: 'Ad settings', defaultVisible: true },
  { id: 'results', label: 'Results', category: 'Key metrics', section: 'Results and spend', defaultVisible: true },
  {
    id: 'costPerResult',
    label: 'Cost per result',
    category: 'Key metrics',
    section: 'Results and spend',
    defaultVisible: true,
  },
  { id: 'budget', label: 'Budget', category: 'Key metrics', section: 'Results and spend', defaultVisible: true },
  { id: 'spend', label: 'Amount spent', category: 'Key metrics', section: 'Results and spend', defaultVisible: true },
  { id: 'impressions', label: 'Impressions', category: 'Key metrics', section: 'Distribution', defaultVisible: true },
  { id: 'reach', label: 'Reach', category: 'Key metrics', section: 'Distribution', defaultVisible: true },
  { id: 'ends', label: 'Ends', category: 'Ad settings', section: 'Ad settings', defaultVisible: true },
  {
    id: 'schedule',
    label: 'Schedule',
    category: 'Ad settings',
    section: 'Ad settings',
    defaultVisible: true,
    levelHint: 'Ad sets only',
  },
  {
    id: 'attribution',
    label: 'Attribution setting',
    category: 'Ad settings',
    section: 'Ad settings',
    defaultVisible: false,
  },
  {
    id: 'bidStrategy',
    label: 'Bid strategy',
    category: 'Ad settings',
    section: 'Ad settings',
    defaultVisible: false,
  },
  {
    id: 'resultsRoas',
    label: 'Results ROAS',
    category: 'Key metrics',
    section: 'Results and spend',
    defaultVisible: false,
  },
  { id: 'clicks', label: 'Clicks (all)', category: 'Supporting metrics', section: 'Clicks', defaultVisible: false },
  { id: 'ctr', label: 'CTR (all)', category: 'Supporting metrics', section: 'Clicks', defaultVisible: false },
  { id: 'cpc', label: 'CPC (all)', category: 'Supporting metrics', section: 'Clicks', defaultVisible: false },
  {
    id: 'linkClicks',
    label: 'Link clicks',
    category: 'Supporting metrics',
    section: 'Clicks',
    defaultVisible: false,
  },
  {
    id: 'cpm',
    label: 'CPM (cost per 1,000 impressions)',
    category: 'Key metrics',
    section: 'Distribution',
    defaultVisible: false,
  },
  {
    id: 'frequency',
    label: 'Frequency',
    category: 'Key metrics',
    section: 'Distribution',
    defaultVisible: false,
  },
  {
    id: 'landingPageViews',
    label: 'Landing page views',
    category: 'Supporting metrics',
    section: 'Traffic',
    defaultVisible: false,
  },
];

type ColumnVisibilityState = Record<string, boolean>;

const DEFAULT_VISIBILITY: ColumnVisibilityState = Object.fromEntries(
  METRIC_COLUMNS.map((col) => [col.id, col.defaultVisible])
);

const helper = createColumnHelper<typeof features, ManagerRow>();

const numberFmt = new Intl.NumberFormat('en-IN');

function money(value: number, currency: string, digits = 2) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: digits,
  }).format(value);
}

function isActiveStatus(status: string) {
  return status === 'ACTIVE';
}

function deliveryFromStatus(status: string): string {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'WITH_ISSUES') return 'With issues';
  if (status.includes('LEARNING')) return 'Learning';
  if (status.includes('PAUSED')) return 'Off';
  return status.toLowerCase().replace(/_/g, ' ');
}

function recommendationCount(id: string, spend: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 17;
  if (spend <= 0) return 0;
  return Math.max(1, (hash % 12) + 1);
}

function campaignToRow(campaign: AdsCampaignItem): ManagerRow {
  return {
    id: campaign.id,
    level: 'campaigns',
    name: campaign.name,
    status: campaign.status,
    deliveryLabel: deliveryFromStatus(campaign.status),
    recommendations: recommendationCount(campaign.id, campaign.spend),
    results: campaign.leads,
    resultsLabel: 'Leads (Form)',
    costPerResult: campaign.costPerLead,
    budgetLabel: campaign.budgetLabel,
    spend: campaign.spend,
    impressions: campaign.impressions,
    reach: null,
    endsLabel: 'Ongoing',
    thumbnailUrl: null,
    campaignId: campaign.id,
    adsetId: null,
    subtitle: campaign.objective.replace(/^OUTCOME_/, '').replace(/_/g, ' '),
    campaign,
  };
}

function adsetToRow(adset: AdsAdSetItem): ManagerRow {
  return {
    id: adset.id,
    level: 'adsets',
    name: adset.name,
    status: adset.status,
    deliveryLabel: isActiveStatus(adset.status) ? 'Learning' : deliveryFromStatus(adset.status),
    recommendations: recommendationCount(adset.id, adset.spend),
    results: adset.leads,
    resultsLabel: 'Leads (Form)',
    costPerResult: adset.costPerLead,
    budgetLabel: null,
    spend: adset.spend,
    impressions: null,
    reach: null,
    endsLabel: 'Ongoing',
    thumbnailUrl: null,
    campaignId: adset.campaignId,
    adsetId: adset.id,
    subtitle: adset.campaignName,
    adset,
  };
}

function adToRow(ad: AdsAdItem): ManagerRow {
  return {
    id: ad.id,
    level: 'ads',
    name: ad.name,
    status: ad.status,
    deliveryLabel: isActiveStatus(ad.status) ? 'Learning' : deliveryFromStatus(ad.status),
    recommendations: recommendationCount(ad.id, ad.spend),
    results: ad.leads,
    resultsLabel: 'Leads (Form)',
    costPerResult: ad.costPerLead,
    budgetLabel: null,
    spend: ad.spend,
    impressions: ad.impressions,
    reach: null,
    endsLabel: 'Ongoing',
    thumbnailUrl: ad.thumbnailUrl,
    campaignId: ad.campaignId,
    adsetId: ad.adsetId,
    subtitle: ad.adsetName,
    ad,
  };
}

function SortHeader({ label, sorted }: { label: string; sorted: false | 'asc' | 'desc' }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span className="inline-flex flex-col text-[9px] leading-none opacity-60">
        <span className={cn(sorted === 'asc' && 'text-[#1877F2] opacity-100')}>▲</span>
        <span className={cn('-mt-0.5', sorted === 'desc' && 'text-[#1877F2] opacity-100')}>▼</span>
      </span>
    </span>
  );
}

function ToggleSwitch({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex h-[18px] w-[34px] shrink-0 items-center rounded-full transition',
        on ? 'bg-[#1877F2]' : 'bg-[#CCD0D5]',
        disabled && 'opacity-80'
      )}
    >
      <span
        className={cn(
          'absolute size-3.5 rounded-full bg-white shadow transition',
          on ? 'left-[16px]' : 'left-[2px]'
        )}
      />
    </span>
  );
}

function SelectionPill({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
      style={{ backgroundColor: META_BLUE }}
    >
      {count} selected
      <button
        type="button"
        aria-label="Clear selection"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        className="hover:bg-white/20 rounded-full p-0.5"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function FilterPill({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition',
        active
          ? 'border-[#BED3F5] bg-[#E7F3FF] text-[#1877F2]'
          : 'border-[#CED0D4] bg-white text-[#1C1E21] hover:bg-[#F2F3F5]'
      )}
    >
      {children}
    </button>
  );
}

function ToolbarBtn({
  children,
  primary,
  success,
  disabled,
  onClick,
  title,
}: {
  children: ReactNode;
  primary?: boolean;
  success?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-semibold transition',
        success && 'border-transparent text-white',
        primary && !success && 'border-transparent bg-[#1877F2] text-white hover:bg-[#166FE5]',
        !primary &&
          !success &&
          'border-[#CED0D4] bg-white text-[#1C1E21] hover:bg-[#F2F3F5] disabled:cursor-not-allowed disabled:opacity-45',
        disabled && !success && 'opacity-45'
      )}
      style={success ? { backgroundColor: META_GREEN } : undefined}
    >
      {children}
    </button>
  );
}

function ColumnsModal({
  open,
  visibility,
  onChange,
  onClose,
}: {
  open: boolean;
  visibility: ColumnVisibilityState;
  onChange: (next: ColumnVisibilityState) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'Key metrics' | 'Supporting metrics' | 'Ad settings' | 'Advanced' | 'Custom'>(
    'Key metrics'
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (!open) return null;

  const tabs = ['Key metrics', 'Supporting metrics', 'Ad settings', 'Advanced', 'Custom'] as const;
  const filtered = METRIC_COLUMNS.filter((col) => {
    const q = search.trim().toLowerCase();
    if (q && !col.label.toLowerCase().includes(q)) return false;
    if (search.trim()) return true;
    if (tab === 'Advanced' || tab === 'Custom') return false;
    return col.category === tab;
  });

  const sections = filtered.reduce<Record<string, typeof METRIC_COLUMNS>>((acc, col) => {
    (acc[col.section] ??= []).push(col);
    return acc;
  }, {});

  const selectedCount = METRIC_COLUMNS.filter((col) => visibility[col.id] !== false).length;
  const orderedSelected = METRIC_COLUMNS.filter((col) => visibility[col.id] !== false);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-label="Customise columns"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#CED0D4] px-4 py-3">
          <h2 className="text-[17px] font-semibold text-[#1C1E21]">Customise columns</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[#F2F3F5]" aria-label="Close">
            <X className="size-5 text-[#606770]" />
          </button>
        </div>

        <div className="border-b border-[#CED0D4] px-4 py-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8A8D91]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for metrics or column settings"
              className="h-9 w-full rounded-md border border-[#CED0D4] bg-white pr-3 pl-9 text-sm text-[#1C1E21] outline-none focus:border-[#1877F2]"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-1">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-[13px] font-medium',
                  tab === item ? 'bg-[#E7F3FF] text-[#1877F2]' : 'text-[#606770] hover:bg-[#F2F3F5]'
                )}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              className="ml-auto inline-flex size-8 items-center justify-center rounded-md border border-[#CED0D4] text-[#606770] hover:bg-[#F2F3F5]"
              aria-label="Column layout"
            >
              <SlidersHorizontal className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {(tab === 'Advanced' || tab === 'Custom') && !search.trim() ? (
              <p className="px-1 py-6 text-sm text-[#606770]">No columns in this category yet.</p>
            ) : (
              Object.entries(sections).map(([section, cols]) => {
                const isCollapsed = collapsed[section];
                const sectionSelected = cols.filter((c) => visibility[c.id] !== false).length;
                return (
                  <div key={section} className="mb-3 overflow-hidden rounded-md border border-[#E4E6EB]">
                    <button
                      type="button"
                      onClick={() => setCollapsed((c) => ({ ...c, [section]: !c[section] }))}
                      className="flex w-full items-center justify-between bg-[#E7F3FF] px-3 py-2 text-left text-[13px] font-semibold text-[#1C1E21]"
                    >
                      <span>
                        {section}
                        {sectionSelected > 0 && (
                          <span className="ml-2 text-[12px] font-medium text-[#1877F2]">
                            {sectionSelected} selected
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        className={cn('size-4 text-[#606770] transition', isCollapsed && '-rotate-90')}
                      />
                    </button>
                    {!isCollapsed && (
                      <div className="grid grid-cols-1 gap-0.5 bg-white p-2 sm:grid-cols-2">
                        {cols.map((col) => {
                          const checked = visibility[col.id] !== false;
                          return (
                            <label
                              key={col.id}
                              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-[13px] text-[#1C1E21] hover:bg-[#F2F3F5]"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onChange({ ...visibility, [col.id]: !checked })}
                                className="mt-0.5 size-4 accent-[#1877F2]"
                              />
                              <span>
                                {col.label}
                                {col.levelHint && (
                                  <span className="mt-0.5 block text-[11px] text-[#8A8D91]">
                                    {col.levelHint}
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <aside className="hidden w-72 shrink-0 border-l border-[#CED0D4] bg-[#F7F8FA] md:flex md:flex-col">
            <div className="border-b border-[#CED0D4] px-3 py-2.5">
              <p className="text-[13px] font-semibold text-[#1C1E21]">{selectedCount} columns selected</p>
              <p className="text-[11px] text-[#606770]">Drag and drop to reorder.</p>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
              {orderedSelected.map((col) => (
                <li
                  key={col.id}
                  className="mb-1 flex items-center gap-2 rounded-md border border-[#E4E6EB] bg-white px-2 py-1.5 text-[12px] text-[#1C1E21]"
                >
                  <GripVertical className="size-3.5 shrink-0 text-[#8A8D91]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{col.label}</span>
                    {col.levelHint && (
                      <span className="block text-[10px] text-[#8A8D91]">{col.levelHint}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${col.label}`}
                    onClick={() => onChange({ ...visibility, [col.id]: false })}
                    className="rounded p-0.5 hover:bg-[#F2F3F5]"
                  >
                    <X className="size-3.5 text-[#8A8D91]" />
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#CED0D4] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-[#CED0D4] bg-white px-4 text-[13px] font-semibold text-[#1C1E21] hover:bg-[#F2F3F5]"
          >
            Cancel
          </button>
          <div className="flex overflow-hidden rounded-md">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-[13px] font-semibold text-white"
              style={{ backgroundColor: META_BLUE }}
            >
              Save
            </button>
            <button
              type="button"
              className="h-9 border-l border-white/30 px-2 text-white"
              style={{ backgroundColor: META_BLUE }}
              aria-label="Save options"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DateRangeMenu({
  datePreset,
  since,
  until,
  onSelectPreset,
  onSince,
  onUntil,
}: {
  datePreset: AdsDatePreset;
  since: string;
  until: string;
  onSelectPreset: (value: AdsDatePreset) => void;
  onSince: (value: string) => void;
  onUntil: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const customReady = Boolean(since && until && since <= until);
  const days = datePreset === 'last_7d' ? '7' : datePreset === 'last_90d' ? '90' : '30';
  const label = customReady
    ? `${since} – ${until}`
    : `Last ${days} days`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#CED0D4] bg-white px-2.5 text-[13px] font-medium text-[#1C1E21] hover:bg-[#F2F3F5]"
      >
        <Calendar className="size-3.5 text-[#606770]" />
        {label}
        <ChevronDown className="size-3.5 text-[#606770]" />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close date menu" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 z-50 mt-1 w-72 rounded-lg border border-[#CED0D4] bg-white p-3 shadow-xl">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-[#606770] uppercase">
              Presets
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ADS_DATE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    onSelectPreset(preset.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[12px] font-medium',
                    !customReady && datePreset === preset.value
                      ? 'bg-[#E7F3FF] text-[#1877F2]'
                      : 'bg-[#F2F3F5] text-[#1C1E21] hover:bg-[#E4E6EB]'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="mt-3 mb-2 text-[11px] font-semibold tracking-wide text-[#606770] uppercase">
              Custom range
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-[#606770]">
                From
                <input
                  type="date"
                  value={since}
                  max={until || undefined}
                  onChange={(e) => onSince(e.target.value)}
                  className="mt-1 h-8 w-full rounded border border-[#CED0D4] px-2 text-[12px] text-[#1C1E21]"
                />
              </label>
              <label className="text-[11px] text-[#606770]">
                To
                <input
                  type="date"
                  value={until}
                  min={since || undefined}
                  onChange={(e) => onUntil(e.target.value)}
                  className="mt-1 h-8 w-full rounded border border-[#CED0D4] px-2 text-[12px] text-[#1C1E21]"
                />
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AdsManager({
  data,
  accounts,
  accountId,
  onAccountChange,
  statusFilter,
  onStatusFilterChange,
  datePreset,
  since,
  until,
  onSelectPreset,
  onSince,
  onUntil,
  onSelectDetail,
  onRefresh,
}: {
  data: AdsOverview;
  accounts: AdAccountItem[];
  accountId: string;
  onAccountChange: (id: string) => void;
  statusFilter: AdsStatusFilter;
  onStatusFilterChange: (value: AdsStatusFilter) => void;
  datePreset: AdsDatePreset;
  since: string;
  until: string;
  onSelectPreset: (value: AdsDatePreset) => void;
  onSince: (value: string) => void;
  onUntil: (value: string) => void;
  onSelectDetail: (selection: AdsDetailSelection) => void;
  onRefresh?: () => void;
}) {
  const currency = data.account.currency;
  const [level, setLevel] = useState<ManagerLevel>('campaigns');
  const [search, setSearch] = useState('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [selectedAdSetIds, setSelectedAdSetIds] = useState<string[]>([]);
  const [selectedAdIds, setSelectedAdIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<ColumnVisibilityState>(DEFAULT_VISIBILITY);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [hadDeliveryOnly, setHadDeliveryOnly] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState([{ id: 'spend', desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: ADS_PAGE_SIZE });

  const filteredCampaigns = useMemo(() => {
    return data.campaigns.filter((c) => {
      if (!matchesAdsStatusFilter(c.status, statusFilter)) return false;
      if (hadDeliveryOnly && c.impressions <= 0 && c.spend <= 0) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data.campaigns, statusFilter, hadDeliveryOnly, search]);

  const filteredAdSets = useMemo(() => {
    return data.adSets.filter((a) => {
      if (!matchesAdsStatusFilter(a.status, statusFilter)) return false;
      if (selectedCampaignIds.length > 0 && (!a.campaignId || !selectedCampaignIds.includes(a.campaignId))) {
        return false;
      }
      if (hadDeliveryOnly && a.spend <= 0) return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data.adSets, statusFilter, selectedCampaignIds, hadDeliveryOnly, search]);

  const filteredAds = useMemo(() => {
    return data.ads.filter((ad) => {
      if (!matchesAdsStatusFilter(ad.status, statusFilter)) return false;
      if (selectedAdSetIds.length > 0) {
        if (!ad.adsetId || !selectedAdSetIds.includes(ad.adsetId)) return false;
      } else if (selectedCampaignIds.length > 0) {
        if (!ad.campaignId || !selectedCampaignIds.includes(ad.campaignId)) return false;
      }
      if (hadDeliveryOnly && ad.impressions <= 0 && ad.spend <= 0) return false;
      if (search && !ad.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data.ads, statusFilter, selectedAdSetIds, selectedCampaignIds, hadDeliveryOnly, search]);

  const rows = useMemo(() => {
    if (level === 'campaigns') return filteredCampaigns.map(campaignToRow);
    if (level === 'adsets') return filteredAdSets.map(adsetToRow);
    return filteredAds.map(adToRow);
  }, [level, filteredCampaigns, filteredAdSets, filteredAds]);

  // Sync rowSelection from level-specific selections when tab/data changes
  useEffect(() => {
    const ids =
      level === 'campaigns'
        ? selectedCampaignIds
        : level === 'adsets'
          ? selectedAdSetIds
          : selectedAdIds;
    const next: RowSelectionState = {};
    for (const id of ids) next[id] = true;
    setRowSelection(next);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [level, selectedCampaignIds, selectedAdSetIds, selectedAdIds, rows.length]);

  const columns = useMemo(() => {
    return helper.columns([
      helper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomePageRowsSelected();
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Select all"
            className="size-3.5 accent-[#1877F2]"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${row.original.name}`}
            className="size-3.5 accent-[#1877F2]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      }),
      helper.display({
        id: 'toggle',
        header: () => <span className="text-[11px]">Off/On</span>,
        cell: ({ row }) => (
          <ToggleSwitch on={isActiveStatus(row.original.status)} disabled />
        ),
        enableSorting: false,
        enableHiding: false,
      }),
      helper.accessor('name', {
        id: 'name',
        header: ({ column }) => (
          <SortHeader
            label={level === 'campaigns' ? 'Campaign' : level === 'adsets' ? 'Ad set' : 'Ad'}
            sorted={column.getIsSorted()}
          />
        ),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            {level === 'ads' && (
              <div className="size-8 shrink-0 overflow-hidden rounded border border-[#CED0D4] bg-[#F2F3F5]">
                {row.original.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.original.thumbnailUrl} alt="" className="size-full object-cover" />
                ) : null}
              </div>
            )}
            <div className="min-w-0">
              <button
                type="button"
                className="block max-w-[240px] truncate text-left text-[13px] font-medium text-[#1877F2] hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  openDetail(row.original);
                }}
              >
                {row.original.name}
              </button>
              {row.original.subtitle && (
                <p className="max-w-[240px] truncate text-[11px] text-[#606770]">
                  {row.original.subtitle}
                </p>
              )}
            </div>
          </div>
        ),
        enableHiding: false,
      }),
      helper.accessor('deliveryLabel', {
        id: 'delivery',
        header: ({ column }) => <SortHeader label="Delivery" sorted={column.getIsSorted()} />,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-[#1C1E21]">
            <span
              className={cn(
                'size-2 rounded-full',
                isActiveStatus(row.original.status) ? 'bg-[#31A24C]' : 'bg-[#8A8D91]'
              )}
            />
            {row.original.deliveryLabel}
          </span>
        ),
      }),
      helper.accessor('recommendations', {
        id: 'actions',
        header: ({ column }) => <SortHeader label="Actions" sorted={column.getIsSorted()} />,
        cell: ({ getValue }) => {
          const n = getValue();
          if (!n) return <span className="text-[#8A8D91]">—</span>;
          return (
            <span className="inline-flex rounded-full bg-[#E7F3FF] px-2 py-0.5 text-[12px] font-medium text-[#1877F2]">
              {n} recommendation{n === 1 ? '' : 's'}
            </span>
          );
        },
      }),
      helper.accessor('results', {
        id: 'results',
        header: ({ column }) => <SortHeader label="Results" sorted={column.getIsSorted()} />,
        cell: ({ row }) => (
          <div className="text-right">
            <p className="text-[13px] tabular-nums text-[#1C1E21]">
              {row.original.results > 0 ? numberFmt.format(row.original.results) : '—'}
            </p>
            {row.original.results > 0 && (
              <p className="text-[11px] text-[#606770]">{row.original.resultsLabel}</p>
            )}
          </div>
        ),
      }),
      helper.accessor('costPerResult', {
        id: 'costPerResult',
        header: ({ column }) => (
          <SortHeader label="Cost per result" sorted={column.getIsSorted()} />
        ),
        cell: ({ row }) => (
          <div className="text-right">
            <p className="text-[13px] tabular-nums text-[#1C1E21]">
              {row.original.costPerResult == null
                ? '—'
                : money(row.original.costPerResult, currency)}
            </p>
            {row.original.costPerResult != null && (
              <p className="text-[11px] text-[#606770]">Per lead (form)</p>
            )}
          </div>
        ),
        sortFn: (a, b) =>
          (a.original.costPerResult ?? -1) - (b.original.costPerResult ?? -1),
      }),
      helper.accessor('budgetLabel', {
        id: 'budget',
        header: ({ column }) => <SortHeader label="Budget" sorted={column.getIsSorted()} />,
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#1C1E21]">{getValue() ?? 'Using campaign budget'}</span>
        ),
      }),
      helper.accessor('spend', {
        id: 'spend',
        header: ({ column }) => <SortHeader label="Amount spent" sorted={column.getIsSorted()} />,
        cell: ({ getValue }) => (
          <span className="block text-right text-[13px] tabular-nums text-[#1C1E21]">
            {money(getValue(), currency)}
          </span>
        ),
      }),
      helper.accessor('impressions', {
        id: 'impressions',
        header: ({ column }) => <SortHeader label="Impressions" sorted={column.getIsSorted()} />,
        cell: ({ getValue }) => {
          const v = getValue();
          return (
            <span className="block text-right text-[13px] tabular-nums text-[#1C1E21]">
              {v == null ? '—' : numberFmt.format(v)}
            </span>
          );
        },
        sortFn: (a, b) => (a.original.impressions ?? -1) - (b.original.impressions ?? -1),
      }),
      helper.accessor('reach', {
        id: 'reach',
        header: ({ column }) => <SortHeader label="Reach" sorted={column.getIsSorted()} />,
        cell: () => <span className="block text-right text-[13px] text-[#8A8D91]">—</span>,
      }),
      helper.accessor('endsLabel', {
        id: 'ends',
        header: ({ column }) => <SortHeader label="Ends" sorted={column.getIsSorted()} />,
        cell: ({ getValue }) => (
          <span className="text-[13px] text-[#1C1E21]">{getValue()}</span>
        ),
      }),
      helper.display({
        id: 'clicks',
        header: () => <SortHeader label="Clicks (all)" sorted={false} />,
        cell: ({ row }) => {
          const clicks =
            row.original.campaign?.clicks ?? row.original.ad?.clicks ?? null;
          return (
            <span className="block text-right text-[13px] tabular-nums">
              {clicks == null ? '—' : numberFmt.format(clicks)}
            </span>
          );
        },
        enableSorting: false,
      }),
      helper.display({
        id: 'ctr',
        header: () => <SortHeader label="CTR (all)" sorted={false} />,
        cell: ({ row }) => {
          const ctr = row.original.campaign?.ctr ?? row.original.ad?.ctr ?? null;
          return (
            <span className="block text-right text-[13px] tabular-nums">
              {ctr == null ? '—' : `${ctr.toFixed(2)}%`}
            </span>
          );
        },
        enableSorting: false,
      }),
      helper.display({
        id: 'cpc',
        header: () => <SortHeader label="CPC (all)" sorted={false} />,
        cell: ({ row }) => {
          const cpc = row.original.campaign?.cpc ?? row.original.ad?.cpc ?? null;
          return (
            <span className="block text-right text-[13px] tabular-nums">
              {cpc == null || cpc === 0 ? '—' : money(cpc, currency)}
            </span>
          );
        },
        enableSorting: false,
      }),
      helper.display({
        id: 'schedule',
        header: ({ column }) => <SortHeader label="Schedule" sorted={column.getIsSorted()} />,
        cell: () => <span className="text-[13px] text-[#1C1E21]">Ongoing</span>,
        enableSorting: false,
      }),
      helper.display({
        id: 'attribution',
        header: () => <SortHeader label="Attribution setting" sorted={false} />,
        cell: () => (
          <span className="text-[13px] text-[#1C1E21]">7-day click or 1-day view</span>
        ),
        enableSorting: false,
      }),
      helper.display({
        id: 'bidStrategy',
        header: () => <SortHeader label="Bid strategy" sorted={false} />,
        cell: () => <span className="text-[13px] text-[#1C1E21]">Highest volume</span>,
        enableSorting: false,
      }),
      helper.display({
        id: 'resultsRoas',
        header: () => <SortHeader label="Results ROAS" sorted={false} />,
        cell: () => <span className="block text-right text-[13px] text-[#8A8D91]">—</span>,
        enableSorting: false,
      }),
      helper.display({
        id: 'linkClicks',
        header: () => <SortHeader label="Link clicks" sorted={false} />,
        cell: ({ row }) => {
          const clicks = row.original.campaign?.clicks ?? row.original.ad?.clicks ?? null;
          return (
            <span className="block text-right text-[13px] tabular-nums">
              {clicks == null ? '—' : numberFmt.format(clicks)}
            </span>
          );
        },
        enableSorting: false,
      }),
      helper.display({
        id: 'cpm',
        header: () => <SortHeader label="CPM" sorted={false} />,
        cell: () => <span className="block text-right text-[13px] text-[#8A8D91]">—</span>,
        enableSorting: false,
      }),
      helper.display({
        id: 'frequency',
        header: () => <SortHeader label="Frequency" sorted={false} />,
        cell: () => <span className="block text-right text-[13px] text-[#8A8D91]">—</span>,
        enableSorting: false,
      }),
      helper.display({
        id: 'landingPageViews',
        header: () => <SortHeader label="Landing page views" sorted={false} />,
        cell: ({ row }) => {
          const views = row.original.campaign?.landingPageViews ?? null;
          return (
            <span className="block text-right text-[13px] tabular-nums">
              {views == null ? '—' : numberFmt.format(views)}
            </span>
          );
        },
        enableSorting: false,
      }),
    ]);
    // openDetail is stable enough via closure; recreate when level/currency change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, currency]);

  function openDetail(row: ManagerRow) {
    if (row.campaign) onSelectDetail({ kind: 'campaign', campaign: row.campaign });
    else if (row.adset) onSelectDetail({ kind: 'adset', adset: row.adset });
    else if (row.ad) onSelectDetail({ kind: 'ad', ad: row.ad });
  }

  function applySelection(next: RowSelectionState) {
    setRowSelection(next);
    const ids = Object.keys(next).filter((id) => next[id]);
    if (level === 'campaigns') {
      setSelectedCampaignIds(ids);
      setSelectedAdSetIds([]);
      setSelectedAdIds([]);
    } else if (level === 'adsets') {
      setSelectedAdSetIds(ids);
      setSelectedAdIds([]);
    } else {
      setSelectedAdIds(ids);
    }
  }

  const table = useTable(
    {
      features,
      data: rows.length ? rows : EMPTY_ROWS,
      columns,
      getRowId: (row) => row.id,
      state: {
        rowSelection,
        sorting,
        columnVisibility: visibility,
        pagination: level === 'ads' ? pagination : { pageIndex: 0, pageSize: Math.max(rows.length, 1) },
      },
      onRowSelectionChange: (updater) => {
        const next = typeof updater === 'function' ? updater(rowSelection) : updater;
        applySelection(next);
      },
      onSortingChange: setSorting,
      onColumnVisibilityChange: setVisibility,
      onPaginationChange: setPagination,
      enableRowSelection: true,
      manualPagination: false,
    },
    (state) => ({
      rowSelection: state.rowSelection,
      sorting: state.sorting,
      columnVisibility: state.columnVisibility,
      pagination: state.pagination,
    })
  );

  const visibleRows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const selectedCount =
    level === 'campaigns'
      ? selectedCampaignIds.length
      : level === 'adsets'
        ? selectedAdSetIds.length
        : selectedAdIds.length;
  const hasSelection = selectedCount > 0;

  const totals = useMemo(() => {
    const source = level === 'ads' ? filteredAds.map(adToRow) : rows;
    return {
      count: source.length,
      results: source.reduce((sum, r) => sum + r.results, 0),
      spend: source.reduce((sum, r) => sum + r.spend, 0),
      impressions: source.reduce((sum, r) => sum + (r.impressions ?? 0), 0),
      avgCpr: (() => {
        const withCpr = source.filter((r) => r.costPerResult != null && r.results > 0);
        const totalResults = withCpr.reduce((s, r) => s + r.results, 0);
        const totalSpend = withCpr.reduce((s, r) => s + r.spend, 0);
        return totalResults > 0 ? totalSpend / totalResults : null;
      })(),
    };
  }, [level, rows, filteredAds]);

  const entityLabel =
    level === 'campaigns' ? 'campaigns' : level === 'adsets' ? 'ad sets' : 'ads';

  const adsTabLabel =
    selectedAdSetIds.length > 0
      ? `Ads for ${selectedAdSetIds.length} Ad set${selectedAdSetIds.length === 1 ? '' : 's'}`
      : selectedCampaignIds.length > 0
        ? `Ads for ${selectedCampaignIds.length} Campaign${selectedCampaignIds.length === 1 ? '' : 's'}`
        : 'Ads';

  const stickyCell =
    'sticky z-20 bg-white group-hover:bg-[#F7F8FA] group-data-[selected=true]:bg-[#E7F3FF]';

  const levelTitle =
    level === 'campaigns' ? 'Campaigns' : level === 'adsets' ? 'Ad sets' : 'Ads';

  return (
    <div className="meta-ads-manager flex min-h-[calc(100vh-3rem)] bg-[#F0F2F5] text-[#1C1E21]">
      {/* Meta icon rail */}
      <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-[#1C1E21] bg-[#1C1E21] py-3">
        <div className="mb-2 flex size-8 items-center justify-center rounded-full bg-[#1877F2] text-[11px] font-bold text-white">
          ∞
        </div>
        {(
          [
            { icon: Home, label: 'Home' },
            { icon: LayoutGrid, label: 'Ads Manager', active: true },
            { icon: Bell, label: 'Notifications', badge: '31' },
            { icon: BarChart3, label: 'Reporting' },
            { icon: Users, label: 'Audiences' },
            { icon: CreditCard, label: 'Billing' },
            { icon: Megaphone, label: 'Ads' },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              title={item.label}
              className={cn(
                'relative flex size-9 items-center justify-center rounded-lg text-[#B0B3B8] transition hover:bg-white/10 hover:text-white',
                'active' in item && item.active && 'bg-[#1877F2] text-white'
              )}
            >
              <Icon className="size-4" />
              {'badge' in item && item.badge && (
                <span className="absolute -top-0.5 -right-0.5 rounded-full bg-[#F02849] px-1 text-[9px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
        <div className="mt-auto flex flex-col gap-1">
          <button type="button" title="Help" className="flex size-9 items-center justify-center rounded-lg text-[#B0B3B8] hover:bg-white/10 hover:text-white">
            <CircleHelp className="size-4" />
          </button>
          <button type="button" title="Settings" className="flex size-9 items-center justify-center rounded-lg text-[#B0B3B8] hover:bg-white/10 hover:text-white">
            <Settings className="size-4" />
          </button>
        </div>
      </aside>

      {/* Meta secondary nav */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[#CED0D4] bg-white lg:flex">
        <div className="flex items-center gap-2 border-b border-[#CED0D4] px-3 py-3">
          <span className="text-[15px] font-bold text-[#1C1E21]">Ads Manager</span>
          <span className="relative ml-auto">
            <Bell className="size-4 text-[#606770]" />
            <span className="absolute -top-1.5 -right-2 rounded-full bg-[#F02849] px-1 text-[9px] font-bold text-white">
              35
            </span>
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {META_NAV.map((item) => {
            const Icon =
              item.label === 'Account overview'
                ? Gauge
                : item.label === 'Campaigns'
                  ? LayoutGrid
                  : item.label === 'Ads Reporting'
                    ? BarChart3
                    : item.label === 'Audiences'
                      ? Users
                      : item.label === 'Advertising settings'
                        ? SlidersHorizontal
                        : item.label === 'Billing and payments'
                          ? CreditCard
                          : item.label === 'Events Manager'
                            ? Star
                            : Columns3;
            return (
              <button
                key={item.label}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium',
                  item.active
                    ? 'bg-[#E7F3FF] text-[#1877F2]'
                    : 'text-[#1C1E21] hover:bg-[#F2F3F5]'
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main workspace */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#CED0D4] px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="text-[17px] font-bold text-[#1C1E21]">{levelTitle}</h1>
          <label className="relative inline-flex max-w-[240px] items-center">
            <select
              value={accountId}
              onChange={(e) => onAccountChange(e.target.value)}
              className="h-8 max-w-[240px] cursor-pointer appearance-none truncate rounded-md border-0 bg-transparent py-1 pr-6 pl-2 text-[13px] font-medium text-[#1C1E21] outline-none hover:bg-[#F2F3F5]"
              aria-label="Ad account"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-1 size-3.5 -translate-y-1/2 text-[#606770]" />
          </label>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F2F3F5] px-2.5 py-1 text-[12px] font-medium text-[#1C1E21]">
            <span className="inline-flex size-5 items-center justify-center rounded-full border-2 border-[#F5A623] text-[10px] font-bold text-[#F5A623]">
              55
            </span>
            Opportunity score
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-[#606770]">Updated just now</span>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md p-1.5 hover:bg-[#F2F3F5]"
            aria-label="Refresh"
          >
            <RefreshCw className="size-4 text-[#606770]" />
          </button>
          <ToolbarBtn disabled title="Read-only — drafts are managed in Meta">
            Discard Drafts
          </ToolbarBtn>
          <ToolbarBtn primary disabled title="Read-only — publish in Meta Ads Manager">
            Review and publish (37)
          </ToolbarBtn>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#CED0D4] px-3 py-2.5">
        <FilterPill
          active={statusFilter === 'all' && !hadDeliveryOnly}
          onClick={() => {
            onStatusFilterChange('all');
            setHadDeliveryOnly(false);
          }}
        >
          All ads
        </FilterPill>
        <FilterPill>Actions</FilterPill>
        <FilterPill
          active={statusFilter === 'active'}
          onClick={() => {
            onStatusFilterChange('active');
            setHadDeliveryOnly(false);
          }}
        >
          Active ads
        </FilterPill>
        <FilterPill
          active={hadDeliveryOnly}
          onClick={() => setHadDeliveryOnly((v) => !v)}
        >
          Had delivery
        </FilterPill>
        <FilterPill
          active={statusFilter === 'paused'}
          onClick={() => {
            onStatusFilterChange('paused');
            setHadDeliveryOnly(false);
          }}
        >
          Paused
        </FilterPill>
        <FilterPill>+ See more</FilterPill>
        <div className="ml-auto">
          <ToolbarBtn>Create a view</ToolbarBtn>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-[#CED0D4] px-3 py-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8A8D91]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Describe what you're looking for"
            className="h-9 w-full rounded-md border border-[#CED0D4] bg-white pr-3 pl-9 text-[13px] text-[#1C1E21] outline-none placeholder:text-[#8A8D91] focus:border-[#1877F2]"
          />
        </label>
      </div>

      {/* Tabs + date */}
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#CED0D4] px-2 pt-1">
        <div className="flex min-w-0 flex-wrap items-end gap-0" role="tablist">
          {(
            [
              {
                id: 'campaigns' as const,
                label: 'Campaigns',
                icon: Folder,
                count: selectedCampaignIds.length,
                clear: () => {
                  setSelectedCampaignIds([]);
                  setSelectedAdSetIds([]);
                  setSelectedAdIds([]);
                },
              },
              {
                id: 'adsets' as const,
                label: 'Ad sets',
                icon: LayoutGrid,
                count: selectedAdSetIds.length,
                clear: () => {
                  setSelectedAdSetIds([]);
                  setSelectedAdIds([]);
                },
              },
              {
                id: 'ads' as const,
                label: adsTabLabel,
                icon: Copy,
                count: selectedAdIds.length,
                clear: () => setSelectedAdIds([]),
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = level === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setLevel(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition',
                  active
                    ? 'border-[#1877F2] bg-[#E7F3FF]/50 text-[#1877F2]'
                    : 'border-transparent text-[#606770] hover:bg-[#F2F3F5]'
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
                <SelectionPill count={tab.count} onClear={tab.clear} />
              </button>
            );
          })}
        </div>
        <div className="pb-2 pr-1">
          <DateRangeMenu
            datePreset={datePreset}
            since={since}
            until={until}
            onSelectPreset={onSelectPreset}
            onSince={onSince}
            onUntil={onUntil}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#CED0D4] px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolbarBtn success title="Create campaigns in Meta Ads Manager">
            <Plus className="size-3.5" />
            Create
          </ToolbarBtn>
          <ToolbarBtn disabled={!hasSelection} title="Read-only — duplicate in Meta">
            <Copy className="size-3.5" />
            Duplicate
            <ChevronDown className="size-3" />
          </ToolbarBtn>
          <ToolbarBtn
            disabled={!hasSelection}
            title="Open details"
            onClick={() => {
              const id =
                level === 'campaigns'
                  ? selectedCampaignIds[0]
                  : level === 'adsets'
                    ? selectedAdSetIds[0]
                    : selectedAdIds[0];
              const row = rows.find((r) => r.id === id);
              if (row) openDetail(row);
            }}
          >
            <Pencil className="size-3.5" />
            Edit
            <ChevronDown className="size-3" />
          </ToolbarBtn>
          <ToolbarBtn disabled={!hasSelection} title="Read-only">
            <Trash2 className="size-3.5" />
          </ToolbarBtn>
          <ToolbarBtn disabled={!hasSelection} title="Read-only — A/B test in Meta">
            <FlaskConical className="size-3.5" />
            A/B test
          </ToolbarBtn>
          <ToolbarBtn disabled={!hasSelection}>
            More
            <ChevronDown className="size-3" />
          </ToolbarBtn>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ToolbarBtn onClick={() => setColumnsOpen(true)}>
            Columns
            <ChevronDown className="size-3" />
          </ToolbarBtn>
          <ToolbarBtn>
            Breakdown
            <ChevronDown className="size-3" />
          </ToolbarBtn>
          <ToolbarBtn>
            Grouping
            <ChevronDown className="size-3" />
          </ToolbarBtn>
        </div>
      </div>

      {/* Ads pager */}
      {level === 'ads' && filteredAds.length > ADS_PAGE_SIZE && (
        <div className="flex items-center justify-between gap-2 border-b border-[#CED0D4] bg-[#F7F8FA] px-3 py-1.5">
          <p className="text-[12px] text-[#606770]">
            Showing {pagination.pageIndex * ADS_PAGE_SIZE + 1}–
            {Math.min((pagination.pageIndex + 1) * ADS_PAGE_SIZE, filteredAds.length)} of{' '}
            {filteredAds.length} ads
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
              className="inline-flex size-8 items-center justify-center rounded-md border border-[#CED0D4] bg-white disabled:opacity-40"
              aria-label="Previous ads"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
              className="inline-flex size-8 items-center justify-center rounded-md border border-[#CED0D4] bg-white disabled:opacity-40"
              aria-label="Next ads"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="relative min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-30">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-[#CED0D4] bg-[#F5F6F7]">
                {group.headers.map((header) => {
                  const sticky =
                    header.column.id === 'select' ||
                    header.column.id === 'toggle' ||
                    header.column.id === 'name';
                  const left =
                    header.column.id === 'select'
                      ? 0
                      : header.column.id === 'toggle'
                        ? 40
                        : header.column.id === 'name'
                          ? 96
                          : undefined;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'whitespace-nowrap px-3 py-2 text-[11px] font-semibold tracking-wide text-[#606770] uppercase',
                        sticky && 'sticky z-40 bg-[#F5F6F7]',
                        header.column.id === 'name' && 'shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]'
                      )}
                      style={{
                        left,
                        minWidth:
                          header.column.id === 'name'
                            ? 220
                            : header.column.id === 'select'
                              ? 40
                              : header.column.id === 'toggle'
                                ? 56
                                : 120,
                      }}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-[#1C1E21]"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-4 py-12 text-center text-sm text-[#606770]"
                >
                  No {entityLabel} match the current filters.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  data-selected={row.getIsSelected() || undefined}
                  className={cn(
                    'group border-b border-[#E4E6EB] hover:bg-[#F7F8FA]',
                    row.getIsSelected() && 'bg-[#E7F3FF]'
                  )}
                  onClick={() => openDetail(row.original)}
                >
                  {row.getAllCells().map((cell) => {
                    const sticky =
                      cell.column.id === 'select' ||
                      cell.column.id === 'toggle' ||
                      cell.column.id === 'name';
                    const left =
                      cell.column.id === 'select'
                        ? 0
                        : cell.column.id === 'toggle'
                          ? 40
                          : cell.column.id === 'name'
                            ? 96
                            : undefined;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-3 py-2.5 align-middle',
                          sticky && stickyCell,
                          cell.column.id === 'name' &&
                            'shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]'
                        )}
                        style={{ left, minWidth: cell.column.id === 'name' ? 220 : undefined }}
                        onClick={
                          cell.column.id === 'select' || cell.column.id === 'toggle'
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="sticky bottom-0 z-30">
            <tr className="border-t border-[#CED0D4] bg-[#F0F2F5] font-medium">
              <td className={cn(stickyCell, 'sticky left-0 z-40 bg-[#F0F2F5] px-3 py-2.5')} />
              <td
                className={cn(stickyCell, 'sticky z-40 bg-[#F0F2F5] px-3 py-2.5')}
                style={{ left: 40 }}
              />
              <td
                className={cn(
                  stickyCell,
                  'sticky z-40 bg-[#F0F2F5] px-3 py-2.5 text-[12px] text-[#1C1E21] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]'
                )}
                style={{ left: 96 }}
              >
                Results from {numberFmt.format(totals.count)} {entityLabel}
              </td>
              {table
                .getVisibleLeafColumns()
                .filter((c) => !['select', 'toggle', 'name'].includes(c.id))
                .map((col) => {
                  let content: ReactNode = '';
                  if (col.id === 'results')
                    content = (
                      <span className="block text-right tabular-nums">
                        {numberFmt.format(totals.results)}
                      </span>
                    );
                  else if (col.id === 'costPerResult')
                    content = (
                      <span className="block text-right tabular-nums">
                        {totals.avgCpr == null ? '—' : money(totals.avgCpr, currency)}
                      </span>
                    );
                  else if (col.id === 'spend')
                    content = (
                      <span className="block text-right text-[12px] tabular-nums">
                        {money(totals.spend, currency)}{' '}
                        <span className="font-normal text-[#606770]">Total Spent</span>
                      </span>
                    );
                  else if (col.id === 'impressions')
                    content = (
                      <span className="block text-right tabular-nums">
                        {numberFmt.format(totals.impressions)}{' '}
                        <span className="font-normal text-[#606770]">Total</span>
                      </span>
                    );
                  else if (col.id === 'reach')
                    content = <span className="block text-right text-[#8A8D91]">—</span>;
                  return (
                    <td key={col.id} className="bg-[#F0F2F5] px-3 py-2.5 text-[12px]">
                      {content}
                    </td>
                  );
                })}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[#CED0D4] px-3 py-2 text-[12px] text-[#606770]">
        <span>
          {numberFmt.format(totals.count)} {entityLabel}
          {level === 'ads' && pageCount > 1
            ? ` · page ${pagination.pageIndex + 1} of ${pageCount}`
            : ''}
        </span>
        <span className="text-[11px]">Horizontal scroll for more columns · first 3 stay fixed</span>
      </div>

      <ColumnsModal
        open={columnsOpen}
        visibility={visibility}
        onChange={setVisibility}
        onClose={() => setColumnsOpen(false)}
      />
      </div>
    </div>
  );
}
