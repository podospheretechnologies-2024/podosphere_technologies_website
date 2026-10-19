/**
 * Caption / tone presets for AI post generation (F3).
 * Safe to import from client components — no secrets, no `server-only`.
 *
 * Image-only presets (F1) live in `config/image-presets.ts` — keep caption tones here.
 */

export const CAPTION_TONE_PRESET_IDS = [
  'professional',
  'playful',
  'urgent',
  'festival-teaser',
  'warm-grateful',
  'educational',
  'bold-promo',
  'storytelling',
] as const;

export type CaptionTonePresetId = (typeof CAPTION_TONE_PRESET_IDS)[number];

export interface CaptionTonePreset {
  id: CaptionTonePresetId;
  label: string;
  /** Short UI hint */
  description: string;
  /** Injected into the Claude task as a hard tone rule */
  promptRule: string;
}

export const CAPTION_TONE_PRESETS: CaptionTonePreset[] = [
  {
    id: 'professional',
    label: 'Professional',
    description: 'Clear, polished, trustworthy',
    promptRule:
      'Tone: professional and polished. Use clear sentences, minimal slang, no excessive emoji. Sound credible for a brand or agency.',
  },
  {
    id: 'playful',
    label: 'Playful',
    description: 'Light, witty, conversational',
    promptRule:
      'Tone: playful and conversational. Light humour is welcome; a few emoji are fine. Keep it friendly, not childish or meme-heavy.',
  },
  {
    id: 'urgent',
    label: 'Urgent',
    description: 'Time-sensitive CTA energy',
    promptRule:
      'Tone: urgent without being spammy. Emphasise scarcity or deadline when the input supports it. Strong but honest CTA; no fake countdowns.',
  },
  {
    id: 'festival-teaser',
    label: 'Festival teaser',
    description: 'Warm festive wish + soft offer',
    promptRule:
      'Tone: warm festival teaser for an Indian audience. Lead with greeting and celebration mood, then a soft brand mention or offer tease. Avoid hard-sell or cultural stereotypes.',
  },
  {
    id: 'warm-grateful',
    label: 'Warm & grateful',
    description: 'Thank-you, community, appreciation',
    promptRule:
      'Tone: warm and grateful. Focus on appreciation, community, or customer love. Soft CTA only if natural.',
  },
  {
    id: 'educational',
    label: 'Educational',
    description: 'Tip / how-to / insight',
    promptRule:
      'Tone: educational and helpful. Lead with a clear tip or insight; keep jargon light; end with an optional soft CTA to learn more.',
  },
  {
    id: 'bold-promo',
    label: 'Bold promo',
    description: 'Offer-forward launch energy',
    promptRule:
      'Tone: bold promotional. Lead with the offer or launch hook, keep benefits concrete, and close with a clear CTA. Avoid ALL-CAPS shouting.',
  },
  {
    id: 'storytelling',
    label: 'Storytelling',
    description: 'Narrative, behind-the-scenes',
    promptRule:
      'Tone: storytelling. Open with a short scene or moment, then connect to the brand or message. Conversational, not salesy.',
  },
];

const BY_ID = new Map(CAPTION_TONE_PRESETS.map((preset) => [preset.id, preset]));

export function isCaptionTonePresetId(value: string): value is CaptionTonePresetId {
  return BY_ID.has(value as CaptionTonePresetId);
}

export function getCaptionTonePreset(id: string | null | undefined): CaptionTonePreset | null {
  if (!id) return null;
  return BY_ID.get(id as CaptionTonePresetId) ?? null;
}

/** Claude task line for a selected tone, or null when none / unknown. */
export function captionTonePromptRule(id: string | null | undefined): string | null {
  return getCaptionTonePreset(id)?.promptRule ?? null;
}
