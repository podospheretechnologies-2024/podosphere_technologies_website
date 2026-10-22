import { describe, it, expect } from 'vitest';
import { GraphApiError } from './graph-client';

/** The real payload behind the `(#10)` backfill failures in the prod worker logs. */
function pagesReadUserContentError(): GraphApiError {
  return new GraphApiError(
    "(#10) This endpoint requires the 'pages_read_user_content' permission or the 'Page Public Content Access' feature.",
    400,
    10,
    undefined,
    'OAuthException',
    'A9HfPhedZN1ZXQhVsJTwU3u'
  );
}

describe('GraphApiError classification', () => {
  it('treats an expired or revoked token as an auth error', () => {
    const error = new GraphApiError('Invalid OAuth access token', 400, 190);
    expect(error.isAuthError).toBe(true);
    expect(error.isPermissionError).toBe(false);
    expect(error.isRateLimitError).toBe(false);
  });

  it('treats throttle codes as retryable rate limits', () => {
    for (const code of [4, 17, 32]) {
      expect(new GraphApiError('rate limited', 400, code).isRateLimitError).toBe(true);
    }
  });

  it('treats an unapproved permission or feature as a permission error', () => {
    const error = pagesReadUserContentError();
    expect(error.isPermissionError).toBe(true);
    // Not an auth error: the token is valid, so the channel must not be marked refreshNeeded.
    expect(error.isAuthError).toBe(false);
    // Not retryable: App Review is the only fix, so BullMQ must not back off and retry.
    expect(error.isRateLimitError).toBe(false);
  });

  it('treats a plain permissions error (code 200) as a permission error', () => {
    expect(new GraphApiError('Permissions error', 403, 200).isPermissionError).toBe(true);
  });

  it('leaves an unknown code unclassified', () => {
    const error = new GraphApiError('Unsupported get request', 400, 100);
    expect(error.isAuthError).toBe(false);
    expect(error.isPermissionError).toBe(false);
    expect(error.isRateLimitError).toBe(false);
  });

  it('leaves an error without a code unclassified', () => {
    const error = new GraphApiError('Graph API request failed (500)', 500);
    expect(error.isPermissionError).toBe(false);
    expect(error.isRateLimitError).toBe(false);
  });
});
