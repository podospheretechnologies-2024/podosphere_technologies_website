import {
  type CaptionTonePresetId,
  getCaptionTonePreset,
} from '../server/ai/presets';

/**
 * India-first festival & occasion calendar (F4).
 * Static dates for v1 — lunar festivals use approximate public dates for 2025–2027.
 */

export interface FestivalOccasion {
  id: string;
  name: string;
  /** ISO calendar dates (YYYY-MM-DD) this occasion falls on */
  dates: string[];
  /** Optional region tags for later filtering */
  regions: string[];
  /** Preferred F3 caption tone when seeding a draft */
  suggestedTonePresetId: CaptionTonePresetId;
  /** Topic text placed into the AI idea box / composer draft */
  draftTopic: string;
}

export interface UpcomingOccasion {
  id: string;
  name: string;
  date: string;
  daysUntil: number;
  regions: string[];
  suggestedTonePresetId: CaptionTonePresetId;
  suggestedToneLabel: string;
  draftTopic: string;
}

export const FESTIVAL_OCCASIONS: FestivalOccasion[] = [
  {
    id: 'new-year',
    name: 'New Year',
    dates: ['2025-01-01', '2026-01-01', '2027-01-01', '2028-01-01'],
    regions: ['india', 'global'],
    suggestedTonePresetId: 'warm-grateful',
    draftTopic:
      'Wish everyone a bright New Year — gratitude for the past year, hope for the next, and a soft brand welcome without a hard sell.',
  },
  {
    id: 'republic-day',
    name: 'Republic Day',
    dates: ['2025-01-26', '2026-01-26', '2027-01-26', '2028-01-26'],
    regions: ['india'],
    suggestedTonePresetId: 'professional',
    draftTopic:
      'Republic Day of India (26 January) — respectful patriotic greeting, unity and the Constitution, light brand presence only.',
  },
  {
    id: 'valentine',
    name: "Valentine's Day",
    dates: ['2025-02-14', '2026-02-14', '2027-02-14', '2028-02-14'],
    regions: ['india', 'global'],
    suggestedTonePresetId: 'playful',
    draftTopic:
      "Valentine's Day — warm, playful message about love, friendship, or gifting; optional soft offer tease for couples or friends.",
  },
  {
    id: 'holi',
    name: 'Holi',
    dates: ['2025-03-14', '2026-03-03', '2027-03-22'],
    regions: ['india'],
    suggestedTonePresetId: 'festival-teaser',
    draftTopic:
      'Holi — colourful, joyful festival wish; celebration of colours and togetherness; soft festive offer tease if relevant.',
  },
  {
    id: 'eid-al-fitr',
    name: 'Eid al-Fitr (approx.)',
    dates: ['2025-03-31', '2026-03-20', '2027-03-10'],
    regions: ['india'],
    suggestedTonePresetId: 'festival-teaser',
    draftTopic:
      'Eid Mubarak (Eid al-Fitr, approximate date) — warm greeting of peace and celebration; respectful tone; soft brand wish only.',
  },
  {
    id: 'eid-al-adha',
    name: 'Eid al-Adha (approx.)',
    dates: ['2025-06-07', '2026-05-27', '2027-05-16'],
    regions: ['india'],
    suggestedTonePresetId: 'warm-grateful',
    draftTopic:
      'Eid Mubarak (Eid al-Adha, approximate date) — sincere greeting focused on faith, family, and generosity; no hard sell.',
  },
  {
    id: 'independence-day',
    name: 'Independence Day',
    dates: ['2025-08-15', '2026-08-15', '2027-08-15', '2028-08-15'],
    regions: ['india'],
    suggestedTonePresetId: 'professional',
    draftTopic:
      'Independence Day of India (15 August) — respectful patriotic greeting; freedom, unity, and progress; keep the brand subtle.',
  },
  {
    id: 'diwali',
    name: 'Diwali',
    dates: ['2025-10-20', '2026-11-08', '2027-10-29'],
    regions: ['india'],
    suggestedTonePresetId: 'festival-teaser',
    draftTopic:
      'Diwali — warm festival of lights greeting; diyas, family, new beginnings; soft festive offer or thank-you for customers.',
  },
  {
    id: 'christmas',
    name: 'Christmas',
    dates: ['2025-12-25', '2026-12-25', '2027-12-25', '2028-12-25'],
    regions: ['india', 'global'],
    suggestedTonePresetId: 'warm-grateful',
    draftTopic:
      'Christmas — warm festive greeting of joy, generosity, and togetherness; optional soft seasonal offer tease.',
  },
];

function parseUtcDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetweenUtc(from: Date, to: Date): number {
  const a = startOfUtcDay(from).getTime();
  const b = startOfUtcDay(to).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** Upcoming occasions within the next `withinDays` (includes today). */
export function getUpcomingOccasions(
  from: Date = new Date(),
  withinDays = 60
): UpcomingOccasion[] {
  const start = startOfUtcDay(from);
  const end = new Date(start.getTime() + withinDays * 24 * 60 * 60 * 1000);
  const upcoming: UpcomingOccasion[] = [];

  for (const occasion of FESTIVAL_OCCASIONS) {
    for (const date of occasion.dates) {
      const day = parseUtcDateOnly(date);
      if (day < start || day > end) continue;
      const tone = getCaptionTonePreset(occasion.suggestedTonePresetId);
      upcoming.push({
        id: occasion.id,
        name: occasion.name,
        date,
        daysUntil: daysBetweenUtc(start, day),
        regions: occasion.regions,
        suggestedTonePresetId: occasion.suggestedTonePresetId,
        suggestedToneLabel: tone?.label ?? occasion.suggestedTonePresetId,
        draftTopic: occasion.draftTopic,
      });
    }
  }

  return upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function formatOccasionDate(iso: string): string {
  const day = parseUtcDateOnly(iso);
  return day.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
