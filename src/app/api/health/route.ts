/**
 * Liveness probe — process is up. No dependency checks.
 * Public: used by uptime monitors; no auth.
 */
export async function GET() {
  return Response.json({ status: 'ok' });
}
