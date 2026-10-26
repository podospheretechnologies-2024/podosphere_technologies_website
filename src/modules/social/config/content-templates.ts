/**
 * Sample content templates for the AI Content Studio.
 * One click fills the prompt (and a matching tone) so users don't start from a blank box.
 * Safe to import from client components — no secrets, no `server-only`.
 *
 * Tone presets live in `server/ai/presets.ts`; festival dates in `config/festival-calendar.ts`.
 */
import type { AiContentFormat } from './ai';
import type { CaptionTonePresetId } from '../server/ai/presets';

export const CONTENT_TEMPLATE_CATEGORIES = [
  'Promotion',
  'Engagement',
  'Education',
  'Social proof',
  'Festival',
  'Behind the scenes',
  'Announcement',
] as const;

export type ContentTemplateCategory = (typeof CONTENT_TEMPLATE_CATEGORIES)[number];

export interface ContentTemplate {
  id: string;
  label: string;
  /** Short UI hint shown on the card. */
  description: string;
  category: ContentTemplateCategory;
  format: AiContentFormat;
  /** Pre-filled prompt the user can edit before generating. Square-bracket slots are placeholders. */
  prompt: string;
  tonePresetId?: CaptionTonePresetId;
}

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  // ---- Posts -------------------------------------------------------------
  {
    id: 'product-launch',
    label: 'Product / service launch',
    description: 'Announce something new with its benefits',
    category: 'Announcement',
    format: 'post',
    tonePresetId: 'bold-promo',
    prompt:
      'Announce the launch of [PRODUCT OR SERVICE]. Explain what it is in one line, list 2–3 concrete benefits and who it is for, and end with a clear call to action to [ACTION, e.g. book a call / visit the link].',
  },
  {
    id: 'limited-offer',
    label: 'Limited-time offer',
    description: 'Drive urgency around a deal',
    category: 'Promotion',
    format: 'post',
    tonePresetId: 'urgent',
    prompt:
      'Promote a limited-time offer: [OFFER DETAILS, e.g. 20% off until Sunday]. Make the deadline and the saving clear, say what the customer gets, and finish with a strong but honest call to action. Do not invent fake countdowns.',
  },
  {
    id: 'how-to-tip',
    label: 'Quick tip / how-to',
    description: 'Teach one useful thing',
    category: 'Education',
    format: 'post',
    tonePresetId: 'educational',
    prompt:
      'Share one practical tip about [TOPIC] that our audience can use today. Lead with the benefit, keep it simple, and end with a soft invitation to learn more from us.',
  },
  {
    id: 'myth-vs-fact',
    label: 'Myth vs fact',
    description: 'Bust a common misconception',
    category: 'Education',
    format: 'post',
    tonePresetId: 'educational',
    prompt:
      'Write a "myth vs fact" post about [TOPIC]. State a common myth people believe, then correct it with the real fact and why it matters. Keep it friendly and credible.',
  },
  {
    id: 'customer-review',
    label: 'Customer love / review',
    description: 'Turn a testimonial into a post',
    category: 'Social proof',
    format: 'post',
    tonePresetId: 'warm-grateful',
    prompt:
      'Turn this customer feedback into a warm social post that thanks them and highlights the result they got: [PASTE THE REVIEW OR RESULT]. Keep their words believable; do not exaggerate.',
  },
  {
    id: 'milestone-thankyou',
    label: 'Milestone thank-you',
    description: 'Celebrate a number or anniversary',
    category: 'Engagement',
    format: 'post',
    tonePresetId: 'warm-grateful',
    prompt:
      'Celebrate a milestone: [MILESTONE, e.g. 1,000 happy customers / 5 years in business]. Thank the community, share what it means to the brand, and keep the tone genuine.',
  },
  {
    id: 'ask-a-question',
    label: 'Engagement question',
    description: 'Spark comments and replies',
    category: 'Engagement',
    format: 'post',
    tonePresetId: 'playful',
    prompt:
      'Write a short, fun post that asks the audience an engaging question about [TOPIC] to get them commenting. Give a little context, then ask one clear question.',
  },
  {
    id: 'festival-greeting',
    label: 'Festival greeting',
    description: 'Warm wish with a soft brand touch',
    category: 'Festival',
    format: 'post',
    tonePresetId: 'festival-teaser',
    prompt:
      'Write a warm festival greeting for [FESTIVAL] for an Indian audience. Lead with the celebration and good wishes, then add a soft brand mention or light offer tease. Avoid stereotypes and hard selling.',
  },

  // ---- Reels -------------------------------------------------------------
  {
    id: 'reel-three-tips',
    label: 'Reel: 3 quick tips',
    description: 'Fast, punchy value in a short video',
    category: 'Education',
    format: 'reel',
    tonePresetId: 'educational',
    prompt:
      'A short reel sharing 3 quick tips about [TOPIC]. Open with a scroll-stopping hook, then one tip per scene with short on-screen text, and close with a call to action to follow or save.',
  },
  {
    id: 'reel-product-demo',
    label: 'Reel: product demo',
    description: 'Show the product in action',
    category: 'Promotion',
    format: 'reel',
    tonePresetId: 'bold-promo',
    prompt:
      'A reel that demos [PRODUCT] in action. Hook with the problem it solves, show 2–3 quick shots of it being used, highlight the key benefit on screen, and end with where to buy or book.',
  },
  {
    id: 'reel-before-after',
    label: 'Reel: before & after',
    description: 'Transformation story',
    category: 'Social proof',
    format: 'reel',
    tonePresetId: 'storytelling',
    prompt:
      'A before-and-after reel for [SERVICE OR TRANSFORMATION]. Start on the "before" problem, reveal the "after" result, and keep the on-screen text short so the transformation does the talking.',
  },
  {
    id: 'reel-trend-hook',
    label: 'Reel: trend-style hook',
    description: 'Scroll-stopping opener',
    category: 'Engagement',
    format: 'reel',
    tonePresetId: 'playful',
    prompt:
      'A trend-style reel about [TOPIC] with a bold, scroll-stopping hook in the first 2 seconds. Fast cuts, short on-screen text, and a relatable angle our audience will want to share.',
  },
  {
    id: 'reel-faq',
    label: 'Reel: answer a FAQ',
    description: 'Reply to a common question',
    category: 'Education',
    format: 'reel',
    tonePresetId: 'educational',
    prompt:
      'A reel that answers the most common question we get about [TOPIC]. State the question as the hook, give a clear answer across a couple of scenes, and end with a call to action.',
  },
  {
    id: 'reel-festival',
    label: 'Reel: festival moment',
    description: 'Festive mood in motion',
    category: 'Festival',
    format: 'reel',
    tonePresetId: 'festival-teaser',
    prompt:
      'A warm festival reel for [FESTIVAL] for an Indian audience. Open with the festive mood, show a few celebratory shots, add a short greeting on screen, and finish with a soft brand wish.',
  },
  {
    id: 'reel-behind-the-scenes',
    label: 'Reel: behind the scenes',
    description: 'Show the people / process',
    category: 'Behind the scenes',
    format: 'reel',
    tonePresetId: 'storytelling',
    prompt:
      'A behind-the-scenes reel showing how [PRODUCT OR SERVICE] is made or delivered. Hook with something surprising, show the process in a few quick scenes, and connect it back to why it matters for the customer.',
  },
];

const BY_ID = new Map(CONTENT_TEMPLATES.map((template) => [template.id, template]));

export function getContentTemplate(id: string | null | undefined): ContentTemplate | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function contentTemplatesForFormat(format: AiContentFormat): ContentTemplate[] {
  return CONTENT_TEMPLATES.filter((template) => template.format === format);
}
