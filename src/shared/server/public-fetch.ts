import 'server-only';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { HttpError } from './http-error';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_REDIRECTS = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; PodosphereBot/1.0)';

export interface PublicFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Redirects to follow; 0 returns the redirect response itself. */
  maxRedirects?: number;
}

// Loopback, private, link-local, carrier-grade NAT, multicast and reserved
// ranges: the server must never be used to reach its own network.
const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv6');
}

function isBlockedAddress(address: string): boolean {
  const mappedIpv4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mappedIpv4) {
    return blockedAddresses.check(mappedIpv4, 'ipv4');
  }
  return blockedAddresses.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
}

export async function assertPublicUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Only http(s) links can be used');
  }
  if (url.username || url.password) {
    throw new HttpError(400, 'Links with credentials cannot be used');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => {
    throw new HttpError(400, `Could not find ${url.hostname}`);
  });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new HttpError(400, 'This link points to a private address and cannot be used');
  }
}

// fetch for URLs typed in by users (pages, feeds, webhooks). Redirects are
// followed by hand so every hop is checked against private addresses.
export async function fetchPublicUrl(
  startUrl: string,
  {
    method = 'GET',
    headers,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
  }: PublicFetchOptions = {}
): Promise<{ url: URL; response: Response }> {
  let url = new URL(startUrl);

  for (let hop = 0; ; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      method,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': USER_AGENT, ...headers },
    }).catch(() => {
      throw new HttpError(400, `Could not reach ${url.hostname}`);
    });

    const location = response.headers.get('location');
    const isRedirect = response.status >= 300 && response.status < 400 && location;
    if (!isRedirect || maxRedirects === 0) {
      return { url, response };
    }

    await response.body?.cancel();
    if (hop >= maxRedirects) {
      throw new HttpError(400, 'The link redirects too many times');
    }
    url = new URL(location, url);
  }
}

// Reads at most `maxBytes` of the body as text; the rest is discarded.
export async function readTextLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return '';
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel();

  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
}
