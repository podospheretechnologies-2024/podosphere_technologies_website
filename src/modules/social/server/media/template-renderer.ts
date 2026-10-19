import 'server-only';
import sharp from 'sharp';
import type { BrandedTemplate, BrandedTemplateId } from '../../config/branded-templates';

export interface BrandVisuals {
  brandName: string;
  logoDataUri: string | null;
  primary: string;
  accent: string;
  text: string;
  mutedText: string;
}

export interface RenderTemplateInput {
  template: BrandedTemplate;
  values: Record<string, string>;
  brand: BrandVisuals;
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function parseHexColour(value: string | null | undefined, fallback: string): string {
  const raw = value?.trim() ?? '';
  if (!HEX.test(raw)) return fallback;
  if (raw.length === 4) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return raw.toUpperCase();
}

/** Relative luminance (0–1) for contrast picks. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastText(bg: string, light = '#FFFFFF', dark = '#0F172A'): string {
  return luminance(bg) > 0.45 ? dark : light;
}

export function mutedOn(bg: string, text: string): string {
  // Soften text colour toward the background for secondary lines.
  const mix = (a: number, b: number) => Math.round(a * 0.72 + b * 0.28);
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const t = parse(text);
  const b = parse(bg);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(t.r, b.r))}${toHex(mix(t.g, b.g))}${toHex(mix(t.b, b.b))}`.toUpperCase();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Word-wrap for SVG text. Character budget is approximate; fine for marketing cards. */
function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const clip = (value: string) =>
    value.length > maxChars ? `${value.slice(0, Math.max(1, maxChars - 1))}…` : value;

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const piece = clip(word);
    const next = current ? `${current} ${piece}` : piece;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = piece;
    if (lines.length >= maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    const last = lines[lines.length - 1]!;
    if (!last.endsWith('…')) lines[lines.length - 1] = clip(`${last}…`);
  }
  return lines.slice(0, maxLines);
}

function tspanBlock(
  lines: string[],
  opts: { x: number; startY: number; lineHeight: number; fill: string; size: number; weight?: number; anchor?: string }
): string {
  const anchor = opts.anchor ?? 'start';
  const weight = opts.weight ?? 600;
  return lines
    .map((line, index) => {
      const y = opts.startY + index * opts.lineHeight;
      return `<text x="${opts.x}" y="${y}" fill="${opts.fill}" font-size="${opts.size}" font-weight="${weight}" font-family="Arial, Helvetica, sans-serif" text-anchor="${anchor}">${escapeXml(line)}</text>`;
    })
    .join('\n');
}

function logoMarkup(brand: BrandVisuals, x: number, y: number, maxH: number, wordmarkFill?: string): string {
  if (!brand.logoDataUri) {
    const fill = wordmarkFill ?? brand.text;
    return `<text x="${x}" y="${y + maxH * 0.7}" fill="${fill}" font-size="${Math.round(maxH * 0.55)}" font-weight="700" font-family="Arial, Helvetica, sans-serif">${escapeXml(brand.brandName)}</text>`;
  }
  const w = Math.round(maxH * 2.4);
  return `<image href="${brand.logoDataUri}" x="${x}" y="${y}" width="${w}" height="${maxH}" preserveAspectRatio="xMinYMid meet" />`;
}

function ctaPill(label: string, x: number, y: number, brand: BrandVisuals): string {
  if (!label.trim()) return '';
  const padX = 28;
  const approxW = Math.min(360, 24 + label.length * 11 + padX * 2);
  const h = 48;
  return `
    <rect x="${x}" y="${y}" rx="24" ry="24" width="${approxW}" height="${h}" fill="${brand.accent}" />
    <text x="${x + approxW / 2}" y="${y + 31}" fill="${contrastText(brand.accent)}" font-size="18" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(label)}</text>
  `;
}

function buildOfferBanner(template: BrandedTemplate, values: Record<string, string>, brand: BrandVisuals): string {
  const { width: w, height: h } = template;
  const headline = wrapLines(values.headline ?? '', 28, 2);
  const offer = wrapLines(values.offer ?? '', 36, 2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brand.primary}"/>
      <stop offset="100%" stop-color="${brand.accent}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <circle cx="${w - 80}" cy="80" r="160" fill="${brand.text}" fill-opacity="0.06"/>
  <circle cx="80" cy="${h - 40}" r="120" fill="${brand.text}" fill-opacity="0.05"/>
  ${logoMarkup(brand, 64, 48, 56)}
  ${tspanBlock(headline, { x: 64, startY: 220, lineHeight: 64, fill: brand.text, size: 56, weight: 800 })}
  ${tspanBlock(offer, { x: 64, startY: 360, lineHeight: 36, fill: brand.mutedText, size: 28, weight: 500 })}
  ${ctaPill(values.cta ?? '', 64, h - 100, brand)}
</svg>`;
}

function buildQuoteCard(template: BrandedTemplate, values: Record<string, string>, brand: BrandVisuals): string {
  const { width: w, height: h } = template;
  const quote = wrapLines(values.quote ?? '', 28, 6);
  const attr = (values.attribution ?? '').trim();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${brand.primary}"/>
  <rect x="72" y="72" width="12" height="${h - 144}" rx="6" fill="${brand.accent}"/>
  <text x="120" y="200" fill="${brand.accent}" font-size="120" font-weight="700" font-family="Georgia, serif">“</text>
  ${tspanBlock(quote, { x: 120, startY: 320, lineHeight: 58, fill: brand.text, size: 42, weight: 600 })}
  ${attr ? `<text x="120" y="${h - 140}" fill="${brand.mutedText}" font-size="28" font-weight="600" font-family="Arial, Helvetica, sans-serif">— ${escapeXml(attr)}</text>` : ''}
  ${logoMarkup(brand, 120, h - 90, 44)}
</svg>`;
}

function buildTestimonial(template: BrandedTemplate, values: Record<string, string>, brand: BrandVisuals): string {
  const { width: w, height: h } = template;
  const quote = wrapLines(values.quote ?? '', 30, 5);
  const name = (values.name ?? '').trim();
  const role = (values.role ?? '').trim();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#F8FAFC"/>
  <rect x="0" y="0" width="${w}" height="18" fill="${brand.accent}"/>
  <rect x="72" y="120" width="${w - 144}" height="${h - 280}" rx="28" fill="${brand.primary}"/>
  <text x="120" y="230" fill="${brand.accent}" font-size="96" font-weight="700" font-family="Georgia, serif">“</text>
  ${tspanBlock(quote, { x: 120, startY: 310, lineHeight: 48, fill: brand.text, size: 34, weight: 500 })}
  <text x="120" y="${h - 220}" fill="${brand.text}" font-size="30" font-weight="700" font-family="Arial, Helvetica, sans-serif">${escapeXml(name)}</text>
  ${role ? `<text x="120" y="${h - 178}" fill="${brand.mutedText}" font-size="22" font-weight="500" font-family="Arial, Helvetica, sans-serif">${escapeXml(role)}</text>` : ''}
  ${logoMarkup(brand, 72, h - 100, 48, brand.primary)}
</svg>`;
}

function buildHiring(template: BrandedTemplate, values: Record<string, string>, brand: BrandVisuals): string {
  const { width: w, height: h } = template;
  const headline = wrapLines(values.headline ?? '', 18, 2);
  const role = wrapLines(values.role ?? '', 22, 3);
  const location = (values.location ?? '').trim();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${brand.primary}"/>
  <rect x="0" y="0" width="28" height="${h}" fill="${brand.accent}"/>
  ${logoMarkup(brand, 80, 80, 56)}
  <text x="80" y="220" fill="${brand.accent}" font-size="22" font-weight="700" font-family="Arial, Helvetica, sans-serif" letter-spacing="4">OPEN ROLE</text>
  ${tspanBlock(headline, { x: 80, startY: 320, lineHeight: 72, fill: brand.text, size: 64, weight: 800 })}
  ${tspanBlock(role, { x: 80, startY: 520, lineHeight: 52, fill: brand.mutedText, size: 40, weight: 600 })}
  ${location ? `<text x="80" y="740" fill="${brand.mutedText}" font-size="28" font-weight="500" font-family="Arial, Helvetica, sans-serif">${escapeXml(location)}</text>` : ''}
  ${ctaPill(values.cta ?? 'Apply now', 80, h - 140, brand)}
</svg>`;
}

function buildEvent(template: BrandedTemplate, values: Record<string, string>, brand: BrandVisuals): string {
  const { width: w, height: h } = template;
  const title = wrapLines(values.title ?? '', 28, 2);
  const date = (values.date ?? '').trim();
  const venue = (values.venue ?? '').trim();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${brand.primary}"/>
  <rect x="${w - 420}" y="0" width="420" height="${h}" fill="${brand.accent}"/>
  ${logoMarkup(brand, 64, 48, 52)}
  <text x="64" y="180" fill="${brand.accent}" font-size="20" font-weight="700" font-family="Arial, Helvetica, sans-serif" letter-spacing="3">EVENT</text>
  ${tspanBlock(title, { x: 64, startY: 260, lineHeight: 56, fill: brand.text, size: 48, weight: 800 })}
  <text x="64" y="420" fill="${brand.mutedText}" font-size="26" font-weight="600" font-family="Arial, Helvetica, sans-serif">${escapeXml(date)}</text>
  ${venue ? `<text x="64" y="470" fill="${brand.mutedText}" font-size="22" font-weight="500" font-family="Arial, Helvetica, sans-serif">${escapeXml(venue)}</text>` : ''}
  ${ctaPill(values.cta ?? '', 64, h - 100, brand)}
  <text x="${w - 210}" y="${h / 2}" fill="${contrastText(brand.accent)}" font-size="28" font-weight="700" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(brand.brandName.slice(0, 18))}</text>
</svg>`;
}

function buildCarousel(template: BrandedTemplate, values: Record<string, string>, brand: BrandVisuals): string {
  const { width: w, height: h } = template;
  const headline = wrapLines(values.headline ?? '', 22, 2);
  const body = wrapLines(values.body ?? '', 28, 5);
  const footer = (values.footer ?? '').trim();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#FFFFFF"/>
  <rect x="0" y="0" width="${w}" height="160" fill="${brand.primary}"/>
  ${logoMarkup(brand, 64, 52, 48)}
  <rect x="64" y="220" width="80" height="8" rx="4" fill="${brand.accent}"/>
  ${tspanBlock(headline, { x: 64, startY: 300, lineHeight: 56, fill: brand.primary, size: 48, weight: 800 })}
  ${tspanBlock(body, { x: 64, startY: 440, lineHeight: 44, fill: mutedOn('#FFFFFF', brand.primary), size: 30, weight: 500 })}
  ${footer ? `<text x="64" y="${h - 80}" fill="${brand.accent}" font-size="24" font-weight="700" font-family="Arial, Helvetica, sans-serif">${escapeXml(footer)}</text>` : ''}
</svg>`;
}

const BUILDERS: Record<BrandedTemplateId, (t: BrandedTemplate, v: Record<string, string>, b: BrandVisuals) => string> = {
  'offer-banner': buildOfferBanner,
  'quote-card': buildQuoteCard,
  testimonial: buildTestimonial,
  hiring: buildHiring,
  event: buildEvent,
  'carousel-slide': buildCarousel,
};

/** Rasterise a branded SVG template to PNG via sharp (no satori dependency). */
export async function renderBrandedTemplatePng(input: RenderTemplateInput): Promise<Buffer> {
  const builder = BUILDERS[input.template.id];
  const svg = builder(input.template, input.values, input.brand);
  return sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
}
