import 'server-only';
import { createHash } from 'node:crypto';

/** SHA-256 hex digest used as the stored API key lookup (never store the raw token). */
export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Extract the Bearer token from an Authorization header, or null if missing/malformed. */
export function extractBearerToken(authorizationHeader: string | null | undefined): string | null {
  const header = authorizationHeader ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * IP allowlist check. Empty/null allowlist allows every IP.
 * Rules are comma-separated exact IPs, or a prefix when written as CIDR-like `a.b.c.0/24`
 * (only the prefix before `/` is matched via startsWith — same behaviour as production).
 */
export function isIpAllowed(allowlist: string | null, ip: string | null): boolean {
  if (!allowlist?.trim()) return true;
  if (!ip) return false;
  return allowlist
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .some((rule) => ip === rule || ip.startsWith(rule.replace(/\/\d+$/, '')));
}
