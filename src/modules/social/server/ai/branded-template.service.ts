import 'server-only';
import { organizationScope, type ClientScope } from '@/shared/server/client-scope';
import { HttpError } from '@/shared/server/http-error';
import { resolveOrgBranding } from '@/shared/server/org-branding';
import {
  BRANDED_TEMPLATES,
  getBrandedTemplate,
  type BrandedTemplate,
} from '../../config/branded-templates';
import type { BrandKit } from '../../config/brand-kit';
import type { MediaItem } from '../../types/media';
import { mediaService } from '../media/media.service';
import {
  contrastText,
  mutedOn,
  parseHexColour,
  renderBrandedTemplatePng,
  type BrandVisuals,
} from '../media/template-renderer';
import type { RenderBrandedTemplateBody } from './branded-template.schema';
import { brandKitService } from './brand-kit.service';

const LOGO_FETCH_TIMEOUT_MS = 8_000;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_PRIMARY = '#0F172A';
const DEFAULT_ACCENT = '#2563EB';

function isBrandKitEmpty(kit: BrandKit): boolean {
  return Object.values(kit).every((value) => !value.trim());
}

async function resolveBrandKit(scope: ClientScope): Promise<BrandKit> {
  const kit = await brandKitService.get(scope);
  if (!isBrandKitEmpty(kit) || scope.customerIds === 'all') {
    return kit;
  }
  return brandKitService.get(organizationScope(scope.organizationId));
}

async function fetchLogoDataUri(url: string | null | undefined): Promise<string | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGO_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'image/*' },
    });
    if (!response.ok) return null;
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
    if (!mime.startsWith('image/')) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > LOGO_MAX_BYTES) return null;
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveBrandVisuals(scope: ClientScope): Promise<BrandVisuals> {
  const [kit, org] = await Promise.all([
    resolveBrandKit(scope),
    resolveOrgBranding({ organizationId: scope.organizationId }),
  ]);

  const primary = parseHexColour(kit.primary_colour || org?.primaryColor, DEFAULT_PRIMARY);
  const accent = parseHexColour(kit.accent_colour, DEFAULT_ACCENT);
  const text = parseHexColour(kit.text_colour, contrastText(primary));
  const logoUrl = kit.logo_url.trim() || org?.logoUrl || null;

  return {
    brandName: kit.brand_name.trim() || org?.name || 'Brand',
    logoDataUri: await fetchLogoDataUri(logoUrl),
    primary,
    accent,
    text,
    mutedText: mutedOn(primary, text),
  };
}

function validateValues(template: BrandedTemplate, values: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const variable of template.variables) {
    const raw = values[variable.key]?.trim() ?? '';
    if (variable.required && !raw) {
      throw new HttpError(400, `${variable.label} is required`);
    }
    if (raw.length > variable.maxLength) {
      throw new HttpError(400, `${variable.label} must be at most ${variable.maxLength} characters`);
    }
    cleaned[variable.key] = raw;
  }
  return cleaned;
}

function listPublic() {
  return BRANDED_TEMPLATES.map(({ id, label, description, width, height, variables }) => ({
    id,
    label,
    description,
    width,
    height,
    variables,
  }));
}

export const brandedTemplateService = {
  list() {
    return listPublic();
  },

  async render(scope: ClientScope, body: RenderBrandedTemplateBody): Promise<MediaItem> {
    const template = getBrandedTemplate(body.templateId);
    if (!template) {
      throw new HttpError(400, 'Unknown template');
    }

    const values = validateValues(template, body.values);
    const brand = await resolveBrandVisuals(scope);
    const png = await renderBrandedTemplatePng({ template, values, brand });
    const slug = brand.brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);

    return mediaService.upload({
      scope,
      fileName: `${slug || 'brand'}-${template.id}-${Date.now()}.png`,
      body: new Blob([new Uint8Array(png)]).stream(),
      declaredSize: png.byteLength,
    });
  },
};
