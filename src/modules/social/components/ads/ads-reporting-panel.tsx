'use client';

import { useMemo, useState } from 'react';
import { ADS_REPORT_BREAKDOWNS, type AdsReportBreakdown, type AdsReportLevel } from '../../types/ads';
import { downloadAdsCsv } from '../../lib/ads-csv';
import { useAdsReport } from '../../hooks/use-ads';
import type { AdsOverviewDateInput } from '../../hooks/use-ads';

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const count = new Intl.NumberFormat('en-IN');

function delta(current: number, previous: number | undefined) {
  if (previous == null) return null;
  const change = current - previous;
  if (change === 0) return '0';
  const sign = change > 0 ? '+' : '';
  return `${sign}${count.format(change)}`;
}

export function AdsReportingPanel({
  accountId,
  currency,
  date,
  onBack,
}: {
  accountId: string;
  currency: string;
  date: AdsOverviewDateInput;
  onBack: () => void;
}) {
  const [level, setLevel] = useState<AdsReportLevel>('campaign');
  const [breakdown, setBreakdown] = useState<AdsReportBreakdown>('none');
  const [compare, setCompare] = useState(false);
  const report = useAdsReport(accountId, date, level, breakdown, compare);
  const rows = useMemo(() => report.data?.rows ?? [], [report.data?.rows]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          spend: acc.spend + row.spend,
          impressions: acc.impressions + row.impressions,
          clicks: acc.clicks + row.clicks,
          leads: acc.leads + row.leads,
        }),
        { spend: 0, impressions: 0, clicks: 0, leads: 0 }
      ),
    [rows]
  );

  function exportCsv() {
    downloadAdsCsv(
      `ads-report-${accountId}-${level}-${breakdown}.csv`,
      [
        'Name',
        'Breakdown',
        'Spend',
        'Impressions',
        'Reach',
        'Clicks',
        'Leads',
        'CTR',
        'CPC',
        ...(compare ? ['Prev spend', 'Prev clicks', 'Prev leads'] : []),
      ],
      rows.map((row) => [
        row.entityName,
        row.breakdownLabel,
        row.spend,
        row.impressions,
        row.reach,
        row.clicks,
        row.leads,
        row.ctr,
        row.cpc,
        ...(compare
          ? [row.previous?.spend ?? '', row.previous?.clicks ?? '', row.previous?.leads ?? '']
          : []),
      ])
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[#F0F2F5] p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="text-[13px] font-semibold text-[#1877F2]">
            ← Campaigns
          </button>
          <h2 className="mt-1 text-[17px] font-bold text-[#050505]">Ads Reporting</h2>
          <p className="text-[13px] text-[#65676B]">
            In-app breakdowns from Meta insights. Export the grid as CSV.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="h-9 rounded-lg border border-[#DADDE1] bg-white px-3 text-[13px] font-semibold text-[#050505] shadow-sm disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['campaign', 'adset', 'ad'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setLevel(item)}
            className={`h-8 rounded-full border px-3 text-[13px] font-medium ${
              level === item
                ? 'border-[#1877F2] bg-[#E7F3FF] text-[#1877F2]'
                : 'border-[#DADDE1] bg-white text-[#050505]'
            }`}
          >
            {item === 'adset' ? 'Ad sets' : item === 'ad' ? 'Ads' : 'Campaigns'}
          </button>
        ))}
        <select
          value={breakdown}
          onChange={(event) => setBreakdown(event.target.value as AdsReportBreakdown)}
          className="h-8 rounded-lg border border-[#DADDE1] bg-white px-2 text-[13px]"
          aria-label="Breakdown"
        >
          {ADS_REPORT_BREAKDOWNS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-[13px] text-[#050505]">
          <input
            type="checkbox"
            checked={compare}
            onChange={(event) => setCompare(event.target.checked)}
          />
          Compare previous period
        </label>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ['Spend', money(totals.spend, currency)],
            ['Impressions', count.format(totals.impressions)],
            ['Clicks', count.format(totals.clicks)],
            ['Leads', count.format(totals.leads)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#DADDE1] bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold tracking-wide text-[#65676B] uppercase">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {report.error && (
        <p className="mb-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#DC2626]">
          {report.error.message}
        </p>
      )}
      {!report.data && !report.error && (
        <p className="text-sm text-[#65676B]">Loading report from Meta…</p>
      )}
      {report.data && rows.length === 0 && (
        <p className="rounded-lg border border-[#DADDE1] bg-white p-6 text-sm text-[#65676B]">
          No insight rows for this range.
        </p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#DADDE1] bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="bg-[#F5F6F7] text-[11px] font-semibold tracking-wide text-[#65676B] uppercase">
              <tr>
                <th className="px-3 py-2.5">Name</th>
                {breakdown !== 'none' && <th className="px-3 py-2.5">Breakdown</th>}
                <th className="px-3 py-2.5 text-right">Spend</th>
                <th className="px-3 py-2.5 text-right">Impr.</th>
                <th className="px-3 py-2.5 text-right">Reach</th>
                <th className="px-3 py-2.5 text-right">Clicks</th>
                <th className="px-3 py-2.5 text-right">Leads</th>
                {compare && <th className="px-3 py-2.5 text-right">vs prev spend</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.entityId}-${row.breakdownLabel}-${index}`} className="border-t border-[#DADDE1]">
                  <td className="max-w-[240px] truncate px-3 py-2 font-medium">{row.entityName}</td>
                  {breakdown !== 'none' && (
                    <td className="px-3 py-2 text-[#65676B]">{row.breakdownLabel}</td>
                  )}
                  <td className="px-3 py-2 text-right tabular-nums">{money(row.spend, currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{count.format(row.impressions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{count.format(row.reach)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{count.format(row.clicks)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{count.format(row.leads)}</td>
                  {compare && (
                    <td className="px-3 py-2 text-right tabular-nums text-[#65676B]">
                      {delta(row.spend, row.previous?.spend) ?? '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
