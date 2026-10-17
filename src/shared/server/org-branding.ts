import 'server-only';
import { prisma } from '@/shared/lib/prisma';

export type OrgBranding = {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  portalTitle: string;
};

const DEFAULT_PRIMARY = '#111827';

const BRANDING_SELECT = {
  name: true,
  slug: true,
  logoUrl: true,
  primaryColor: true,
  portalTitle: true,
} as const;

export function brandingFromOrg(org: {
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  portalTitle?: string | null;
}): OrgBranding {
  return {
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl ?? null,
    primaryColor: org.primaryColor?.trim() || DEFAULT_PRIMARY,
    portalTitle: org.portalTitle?.trim() || org.name || 'Client Portal',
  };
}

/** Normalize Host header / domain input → lowercase hostname without port. */
export function normalizeHostname(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0]?.trim().toLowerCase() ?? '';
  if (!hostname) return null;
  return hostname;
}

/** Platform apex from APP_URL (e.g. app.example.com → example.com host as configured). */
export function platformRootHost(): string | null {
  const raw = process.env.APP_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/**
 * Parse `{slug}.{APP_URL host}` → slug.
 * When APP_URL is unset, falls back to first label of a ≥3-part host (legacy).
 * Apex / www / localhost / non-platform hosts → null (use customDomain instead).
 */
export function orgSlugFromHost(host: string | null): string | null {
  const hostname = normalizeHostname(host);
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return null;

  const root = platformRootHost();
  if (root) {
    if (hostname === root || hostname === `www.${root}`) return null;
    if (!hostname.endsWith(`.${root}`)) return null;
    const sub = hostname.slice(0, -(root.length + 1));
    if (!sub || sub.includes('.') || sub === 'www' || sub === 'app' || sub === 'api') return null;
    return sub;
  }

  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  const slug = parts[0];
  if (!slug || slug === 'www' || slug === 'app' || slug === 'api') return null;
  return slug;
}

/**
 * Host that is not the platform subdomain pattern → candidate custom domain.
 * Actual ownership is confirmed via DB (`Organization.customDomain`).
 */
export function customDomainFromHost(host: string | null): string | null {
  const hostname = normalizeHostname(host);
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return null;
  if (orgSlugFromHost(host)) return null;

  const root = platformRootHost();
  if (root && (hostname === root || hostname === `www.${root}`)) return null;
  if (!hostname.includes('.')) return null;
  return hostname;
}

/** Resolve agency branding by id, subdomain slug, or custom domain. */
export async function resolveOrgBranding(opts: {
  organizationId?: string | null;
  slug?: string | null;
  customDomain?: string | null;
}): Promise<OrgBranding | null> {
  if (opts.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: opts.organizationId },
      select: BRANDING_SELECT,
    });
    return org ? brandingFromOrg(org) : null;
  }

  const slug = opts.slug?.trim().toLowerCase();
  if (slug) {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: BRANDING_SELECT,
    });
    if (org) return brandingFromOrg(org);
  }

  const domain = normalizeHostname(opts.customDomain);
  if (domain) {
    const org = await prisma.organization.findUnique({
      where: { customDomain: domain },
      select: BRANDING_SELECT,
    });
    return org ? brandingFromOrg(org) : null;
  }

  return null;
}

/** True when an active org has this hostname as `customDomain` (Caddy on-demand ask). */
export async function orgExistsForCustomDomain(host: string | null): Promise<boolean> {
  const domain = normalizeHostname(host);
  if (!domain) return false;
  const org = await prisma.organization.findFirst({
    where: { customDomain: domain, deletedAt: null },
    select: { id: true },
  });
  return Boolean(org);
}

/** Basic hostname validation for settings API (no scheme/path/port/IP). */
export function isValidCustomHostname(value: string): boolean {
  const hostname = normalizeHostname(value);
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
  if (hostname.length > 253) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
  // labels: 1–63 alnum/hyphen, no leading/trailing hyphen; ≥2 labels
  return /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
    hostname
  );
}
