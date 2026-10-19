import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '@/shared/server/http-error';

/**
 * Verifies Meta `X-Hub-Signature-256` (sha256=<hex>) against the raw request body.
 * Pass the app secret explicitly so callers can decide when to skip (e.g. local/dev).
 */
export function verifyMetaHubSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): void {
  if (!signatureHeader?.startsWith('sha256=')) {
    throw new HttpError(401, 'Missing Meta signature');
  }
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.slice('sha256='.length);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, 'Invalid Meta signature');
  }
}
