/**
 * Post-deploy smoke checks for public Podosphere Social surfaces.
 *
 *   APP_URL=https://social.example.com pnpm smoke
 *
 * Optional:
 *   SMOKE_COOKIE='session=…'  — sent as Cookie on every request (unused by public
 *                                routes below; reserved for future gated checks).
 *   Without a cookie, authenticated flows are skipped (see Manual QA note).
 *
 * Authenticated smoke (magic-link portal, ads sync, OAuth reconnect) is not
 * automated here — run those manually after deploy.
 *
 * Exit 0 only when every required check returns HTTP 200.
 */
import 'dotenv/config';

const base = (process.env.APP_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const cookie = process.env.SMOKE_COOKIE?.trim();

type Check = {
  path: string;
  label: string;
  /** When true, skip if SMOKE_COOKIE is unset (no auth-gated checks today). */
  requiresCookie?: boolean;
};

const CHECKS: Check[] = [
  { path: '/api/health', label: 'health' },
  { path: '/api/health/ready', label: 'health ready' },
  { path: '/support', label: 'support page' },
  { path: '/data-deletion', label: 'data-deletion page' },
  { path: '/privacy', label: 'privacy page' },
];

let passed = 0;
let failed = 0;
let skipped = 0;

async function hit(check: Check): Promise<void> {
  if (check.requiresCookie && !cookie) {
    skipped++;
    console.log(`  ○ ${check.label}  (skipped — set SMOKE_COOKIE to run)`);
    return;
  }

  const url = `${base}${check.path}`;
  const headers: HeadersInit = { Accept: 'text/html, application/json' };
  if (cookie) {
    headers.Cookie = cookie;
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'manual',
    });
    if (res.status === 200) {
      passed++;
      console.log(`  ✔ ${check.label}  ${res.status}  ${check.path}`);
      return;
    }
    failed++;
    console.log(`  ✘ ${check.label}  ${res.status}  ${check.path}`);
  } catch (error) {
    failed++;
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  ✘ ${check.label}  ${check.path}\n      ${msg}`);
  }
}

async function main() {
  console.log(`\nSmoke (public) → ${base}`);
  if (cookie) {
    console.log('Cookie: SMOKE_COOKIE set');
  } else {
    console.log('Cookie: none (public checks only)');
  }
  console.log('');

  for (const check of CHECKS) {
    await hit(check);
  }

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  console.log(
    'Manual QA (not in this script): magic-link client portal, ads account sync,'
  );
  console.log('Meta OAuth reconnect (Facebook/Instagram), WhatsApp send + webhook echo.\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
