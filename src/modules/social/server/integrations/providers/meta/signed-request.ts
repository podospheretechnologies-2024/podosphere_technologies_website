import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '@/shared/server/http-error';

export interface MetaSignedRequest {
  algorithm: string;
  issued_at: number;
  /** App-scoped Facebook user id. */
  user_id: string;
}

/**
 * Verifies a `signed_request` sent by Meta (data deletion / deauthorize callbacks).
 * https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
export function parseMetaSignedRequest(signedRequest: string, appSecret: string): MetaSignedRequest {
  const [encodedSignature, encodedPayload] = signedRequest.split('.', 2);
  if (!encodedSignature || !encodedPayload) {
    throw new HttpError(400, 'Malformed signed_request');
  }

  const signature = Buffer.from(encodedSignature, 'base64url');
  const expected = createHmac('sha256', appSecret).update(encodedPayload).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    throw new HttpError(403, 'Invalid signed_request signature');
  }

  let payload: MetaSignedRequest;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as MetaSignedRequest;
  } catch {
    throw new HttpError(400, 'Malformed signed_request payload');
  }
  if (payload.algorithm?.toUpperCase() !== 'HMAC-SHA256' || !payload.user_id) {
    throw new HttpError(400, 'Unsupported signed_request');
  }
  return payload;
}
