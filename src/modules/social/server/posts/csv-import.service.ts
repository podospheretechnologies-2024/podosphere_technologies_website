import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SocialIntegration } from '@/generated/prisma/client';
import { HttpError } from '@/shared/server/http-error';
import type { ClientScope } from '@/shared/server/client-scope';
import { organizationScope } from '@/shared/server/client-scope';
import { logAudit } from '@/shared/server/audit.service';
import {
  CSV_CHANNEL_HEADER_HINTS,
  CSV_DATE_HEADER_HINTS,
  CSV_IMPORT_MAX_ROWS,
  CSV_MEDIA_HEADER_HINTS,
  CSV_TEXT_HEADER_HINTS,
  CSV_TIME_HEADER_HINTS,
} from '../../config/csv-import';
import { POST_CONTENT_MAX_LENGTH, POST_MAX_MEDIA } from '../../config/posts';
import type {
  CsvImportCreateResponse,
  CsvImportPreviewResponse,
  CsvImportRowPreview,
} from '../../types/csv-import';
import type { PostMedia } from '../../types/post';
import { integrationRepository } from '../integrations/integration.repository';
import { mediaService } from '../media/media.service';
import { publishQueue } from '../publishing/publish.queue';
import { postRepository, type CreateGroupData } from './post.repository';
import type { CsvImportCreateBody, CsvImportPreviewBody } from './csv-import.schema';

// Small tolerance so a post scheduled for "right now" is not rejected by clock drift.
const PAST_DATE_TOLERANCE_MS = 60 * 1000;

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/^media urls?$/, 'media url');
}

function pickHeaderIndex(headers: string[], hints: readonly string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const hint of hints) {
    const exact = normalized.findIndex((h) => h === hint);
    if (exact >= 0) return exact;
  }
  for (const hint of hints) {
    const partial = normalized.findIndex((h) => h.includes(hint));
    if (partial >= 0) return partial;
  }
  return -1;
}

/** RFC 4180-ish CSV parse: commas, quotes, CRLF; strips a leading BOM. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (ch === '\r') {
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

function parseFlexibleDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    if (serial > 20000 && serial < 80000) {
      const utc = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000;
      return new Date(utc).toISOString().slice(0, 10);
    }
  }

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return null;
}

/** Returns minutes since midnight, or null. */
function parseFlexibleTime(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^0?\.\d+$/.test(value) || (/^\d+(\.\d+)?$/.test(value) && Number(value) < 1)) {
    const fraction = Number(value);
    if (fraction >= 0 && fraction < 1) {
      return Math.round(fraction * 24 * 60) % (24 * 60);
    }
  }

  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[4]?.toLowerCase();
  if (minutes > 59 || hours > 23) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
  }

  if (hours > 23) return null;
  return hours * 60 + minutes;
}

function formatTimeMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Builds an absolute Instant for date+time in `timeZone` (e.g. Asia/Kolkata).
 * Binary-searches UTC candidates so we don't need a TZ library.
 */
function zonedDateTimeToUtc(
  date: string,
  minutesSinceMidnight: number,
  timeZone: string
): Date | null {
  const [y, mo, d] = date.split('-').map(Number);
  if (!y || !mo || !d) return null;

  const hour = Math.floor(minutesSinceMidnight / 60);
  const minute = minutesSinceMidnight % 60;
  const want = { y, mo, d, hour, minute };

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  function parts(ms: number) {
    const map = Object.fromEntries(
      formatter.formatToParts(new Date(ms)).map((p) => [p.type, p.value])
    );
    return {
      y: Number(map.year),
      mo: Number(map.month),
      d: Number(map.day),
      hour: Number(map.hour),
      minute: Number(map.minute),
    };
  }

  function compare(a: ReturnType<typeof parts>) {
    return (
      (a.y - want.y) * 1e8 +
      (a.mo - want.mo) * 1e6 +
      (a.d - want.d) * 1e4 +
      (a.hour - want.hour) * 100 +
      (a.minute - want.minute)
    );
  }

  let lo = Date.UTC(y, mo - 1, d, hour, minute) - 14 * 60 * 60 * 1000;
  let hi = Date.UTC(y, mo - 1, d, hour, minute) + 14 * 60 * 60 * 1000;

  while (hi - lo > 60_000) {
    const mid = Math.floor((lo + hi) / 2);
    if (compare(parts(mid)) < 0) lo = mid;
    else hi = mid;
  }

  for (let ms = lo; ms <= hi; ms += 60_000) {
    if (compare(parts(ms)) === 0) return new Date(ms);
  }
  return null;
}

function splitList(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0') return true;
  if (host === '::1' || host === '::') return true;
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function resolveChannelToken(
  token: string,
  integrations: SocialIntegration[]
): { id: string; name: string } | { error: string } {
  const raw = token.trim();
  if (!raw) return { error: 'Empty channel' };

  const byId = integrations.find((i) => i.id === raw);
  if (byId) return { id: byId.id, name: byId.name };

  const needle = raw.replace(/^@/, '').toLowerCase();

  const byName = integrations.filter((i) => i.name.toLowerCase() === needle);
  if (byName.length === 1) return { id: byName[0].id, name: byName[0].name };
  if (byName.length > 1) {
    return { error: `Channel "${raw}" matches multiple accounts; use the channel id` };
  }

  const byUsername = integrations.filter(
    (i) => (i.username ?? '').replace(/^@/, '').toLowerCase() === needle
  );
  if (byUsername.length === 1) return { id: byUsername[0].id, name: byUsername[0].name };
  if (byUsername.length > 1) {
    return { error: `Username "${raw}" matches multiple accounts; use the channel id` };
  }

  const byProvider = integrations.filter((i) => i.providerIdentifier.toLowerCase() === needle);
  if (byProvider.length === 1) return { id: byProvider[0].id, name: byProvider[0].name };
  if (byProvider.length > 1) {
    return {
      error: `Provider "${raw}" matches ${byProvider.length} channels; use a channel name or id`,
    };
  }

  return { error: `Unknown channel "${raw}"` };
}

function assertChannelsInScope(
  scope: ClientScope,
  integrations: { id: string; customerId: string | null }[]
) {
  if (scope.customerIds === 'all') return;
  for (const integration of integrations) {
    if (!integration.customerId || !scope.customerIds.includes(integration.customerId)) {
      throw new HttpError(404, 'Not found');
    }
  }
}

async function queueForPublishing(organizationId: string, group: string) {
  const rows = await postRepository.findGroup(organizationScope(organizationId), group);
  const jobs = rows
    .filter((row) => !row.parentPostId && row.state === 'QUEUE')
    .map((row) => ({ postId: row.id, publishDate: row.publishDate, runAt: row.publishDate }));

  try {
    await publishQueue.schedule(jobs);
  } catch (error) {
    console.error(`[social] could not queue csv import group ${group}`, error);
  }
}

function buildPreviewRows(
  table: string[][],
  integrations: SocialIntegration[],
  timeZone: string
): Omit<CsvImportPreviewResponse, 'timeZone'> {
  if (table.length === 0) {
    throw new HttpError(400, 'CSV has no rows');
  }

  const headers = table[0].map((h) => h.trim());
  const dateIdx = pickHeaderIndex(headers, CSV_DATE_HEADER_HINTS);
  const timeIdx = pickHeaderIndex(headers, CSV_TIME_HEADER_HINTS);
  const channelIdx = pickHeaderIndex(headers, CSV_CHANNEL_HEADER_HINTS);
  const textIdx = pickHeaderIndex(headers, CSV_TEXT_HEADER_HINTS);
  const mediaIdx = pickHeaderIndex(headers, CSV_MEDIA_HEADER_HINTS);

  if (dateIdx < 0) {
    throw new HttpError(400, 'CSV needs a date column (e.g. date, schedule, publish date)');
  }
  if (channelIdx < 0) {
    throw new HttpError(400, 'CSV needs a channels column (e.g. channels, platform, account)');
  }
  if (textIdx < 0) {
    throw new HttpError(400, 'CSV needs a text column (e.g. text, caption, content)');
  }

  const dataRows = table.slice(1);
  if (dataRows.length === 0) {
    throw new HttpError(400, 'CSV has a header but no data rows');
  }
  if (dataRows.length > CSV_IMPORT_MAX_ROWS) {
    throw new HttpError(400, `CSV has too many rows (max ${CSV_IMPORT_MAX_ROWS})`);
  }

  const rows: CsvImportRowPreview[] = dataRows.map((cells, index) => {
    const rowIndex = index + 2;
    const errors: string[] = [];
    const dateRaw = cells[dateIdx] ?? '';
    const timeRaw = timeIdx >= 0 ? (cells[timeIdx] ?? '') : '09:00';
    const channelRaw = cells[channelIdx] ?? '';
    const text = (cells[textIdx] ?? '').trim();
    const mediaRaw = mediaIdx >= 0 ? (cells[mediaIdx] ?? '') : '';

    const date = parseFlexibleDate(dateRaw);
    if (!date) errors.push('Invalid or missing date');

    const timeMinutes = parseFlexibleTime(timeRaw || '09:00');
    if (timeMinutes == null) errors.push('Invalid time (use HH:mm)');

    const channelTokens = splitList(channelRaw);
    if (channelTokens.length === 0) errors.push('At least one channel is required');

    const channelIds: string[] = [];
    const channelNames: string[] = [];
    for (const token of channelTokens) {
      const resolved = resolveChannelToken(token, integrations);
      if ('error' in resolved) {
        errors.push(resolved.error);
      } else if (channelIds.includes(resolved.id)) {
        errors.push(`Duplicate channel "${token}"`);
      } else {
        channelIds.push(resolved.id);
        channelNames.push(resolved.name);
      }
    }

    if (!text) errors.push('Text is required');
    else if (text.length > POST_CONTENT_MAX_LENGTH) {
      errors.push(`Text is too long (max ${POST_CONTENT_MAX_LENGTH})`);
    }

    const mediaUrls = splitList(mediaRaw);
    if (mediaUrls.length > POST_MAX_MEDIA) {
      errors.push(`Too many media URLs (max ${POST_MAX_MEDIA})`);
    }
    for (const url of mediaUrls) {
      if (!isHttpUrl(url)) {
        errors.push(`Invalid media URL: ${url}`);
      } else if (isBlockedHost(new URL(url).hostname)) {
        errors.push(`Media URL host is not allowed: ${new URL(url).hostname}`);
      }
    }

    let publishAt: string | null = null;
    if (date && timeMinutes != null) {
      const instant = zonedDateTimeToUtc(date, timeMinutes, timeZone);
      if (!instant) {
        errors.push('Could not resolve date/time in the selected time zone');
      } else if (instant.getTime() < Date.now() - PAST_DATE_TOLERANCE_MS) {
        errors.push('Schedule time must be in the future');
      } else {
        publishAt = instant.toISOString();
      }
    }

    return {
      rowIndex,
      date,
      time: timeMinutes != null ? formatTimeMinutes(timeMinutes) : null,
      channels: channelTokens,
      channelIds,
      channelNames,
      text,
      mediaUrls,
      publishAt,
      errors,
      valid: errors.length === 0,
    };
  });

  return {
    headers,
    mapped: {
      date: dateIdx >= 0 ? headers[dateIdx] : null,
      time: timeIdx >= 0 ? headers[timeIdx] : null,
      channels: channelIdx >= 0 ? headers[channelIdx] : null,
      text: textIdx >= 0 ? headers[textIdx] : null,
      mediaUrl: mediaIdx >= 0 ? headers[mediaIdx] : null,
    },
    rows,
    validCount: rows.filter((r) => r.valid).length,
    errorCount: rows.filter((r) => !r.valid).length,
  };
}

export const csvImportService = {
  async preview(scope: ClientScope, body: CsvImportPreviewBody): Promise<CsvImportPreviewResponse> {
    const integrations = await integrationRepository.list(scope);
    const preview = buildPreviewRows(parseCsv(body.csv), integrations, body.timeZone);
    return { ...preview, timeZone: body.timeZone };
  },

  async create(scope: ClientScope, body: CsvImportCreateBody): Promise<CsvImportCreateResponse> {
    const organizationId = scope.organizationId;
    const allChannelIds = [...new Set(body.rows.flatMap((row) => row.channelIds))];
    const integrations = await integrationRepository.findManyByIds(organizationId, allChannelIds);
    assertChannelsInScope(scope, integrations);

    if (integrations.length !== allChannelIds.length) {
      throw new HttpError(400, 'One or more channels no longer exist');
    }

    const integrationById = new Map(integrations.map((i) => [i.id, i]));

    for (const row of body.rows) {
      const publishDate = new Date(row.publishAt);
      if (publishDate.getTime() < Date.now() - PAST_DATE_TOLERANCE_MS) {
        throw new HttpError(400, `Row ${row.rowIndex}: schedule time must be in the future`);
      }
      if (!row.text.trim() && row.mediaUrls.length === 0) {
        throw new HttpError(400, `Row ${row.rowIndex}: write something or attach media`);
      }
      for (const id of row.channelIds) {
        const integration = integrationById.get(id);
        if (!integration) {
          throw new HttpError(400, `Row ${row.rowIndex}: channel not found`);
        }
        if (integration.disabled) {
          throw new HttpError(400, `Row ${row.rowIndex}: ${integration.name} is disabled`);
        }
        if (integration.refreshNeeded) {
          throw new HttpError(
            400,
            `Row ${row.rowIndex}: ${integration.name} must be reconnected before posting`
          );
        }
      }
    }

    const mediaByUrl = new Map<string, PostMedia>();
    const uniqueUrls = [...new Set(body.rows.flatMap((row) => row.mediaUrls))];
    for (const url of uniqueUrls) {
      const uploaded = await mediaService.uploadFromUrl(scope, url);
      mediaByUrl.set(url, {
        id: uploaded.id,
        url: uploaded.url,
        type: uploaded.type,
        format: uploaded.format,
        alt: uploaded.alt,
      });
    }

    const groupsData: CreateGroupData[] = body.rows.map((row) => {
      const media = row.mediaUrls.map((url) => mediaByUrl.get(url)!);
      return {
        organizationId,
        group: randomUUID(),
        state: 'QUEUE',
        publishDate: new Date(row.publishAt),
        tagIds: [],
        creationMethod: 'WEB',
        threads: row.channelIds.map((integrationId) => ({
          integrationId,
          firstComment: null,
          values: [{ content: row.text.trim(), media, delay: 0 }],
        })),
      };
    });

    await postRepository.createGroups(groupsData);

    for (const data of groupsData) {
      await queueForPublishing(organizationId, data.group);
    }

    await logAudit({
      action: 'post.csv_import',
      targetType: 'post_group',
      targetId: groupsData[0]?.group,
      metadata: { created: groupsData.length, groups: groupsData.map((g) => g.group) },
    });

    return {
      created: groupsData.length,
      groups: groupsData.map((g) => g.group),
    };
  },
};
