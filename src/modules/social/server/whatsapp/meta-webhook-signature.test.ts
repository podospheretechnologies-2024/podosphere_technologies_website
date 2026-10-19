import { createHmac } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { HttpError } from '@/shared/server/http-error';
import { verifyMetaHubSignature } from './meta-webhook-signature';
import { parseMetaSignedRequest } from '../integrations/providers/meta/signed-request';

vi.mock('server-only', () => ({}));

function hubSignature(rawBody: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

describe('verifyMetaHubSignature', () => {
  const secret = 'meta-app-secret-test';
  const body = '{"object":"page","entry":[]}';

  it('accepts a valid X-Hub-Signature-256', () => {
    expect(() =>
      verifyMetaHubSignature(body, hubSignature(body, secret), secret)
    ).not.toThrow();
  });

  it('rejects a missing or malformed header', () => {
    expect(() => verifyMetaHubSignature(body, null, secret)).toThrow(HttpError);
    expect(() => verifyMetaHubSignature(body, 'sha1=abc', secret)).toThrow('Missing Meta signature');
  });

  it('rejects a wrong signature', () => {
    expect(() =>
      verifyMetaHubSignature(body, hubSignature(body, 'other-secret'), secret)
    ).toThrow('Invalid Meta signature');
  });

  it('rejects a tampered body', () => {
    const header = hubSignature(body, secret);
    expect(() => verifyMetaHubSignature(body + ' ', header, secret)).toThrow(
      'Invalid Meta signature'
    );
  });
});

describe('parseMetaSignedRequest', () => {
  const appSecret = 'meta-signed-request-secret';

  function makeSignedRequest(payload: object, secret = appSecret): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const encodedSignature = createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedSignature}.${encodedPayload}`;
  }

  it('parses a valid signed_request', () => {
    const payload = { algorithm: 'HMAC-SHA256', issued_at: 1_700_000_000, user_id: 'fb-user-1' };
    expect(parseMetaSignedRequest(makeSignedRequest(payload), appSecret)).toEqual(payload);
  });

  it('rejects a bad signature', () => {
    expect(() =>
      parseMetaSignedRequest(
        makeSignedRequest({ algorithm: 'HMAC-SHA256', user_id: 'u' }, 'wrong'),
        appSecret
      )
    ).toThrow('Invalid signed_request signature');
  });

  it('rejects malformed input', () => {
    expect(() => parseMetaSignedRequest('no-dot', appSecret)).toThrow('Malformed signed_request');
  });
});
