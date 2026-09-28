import 'server-only';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { HttpError } from '@/shared/server/http-error';

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_LENGTH = 20_000;
// An <article>/<main> block shorter than this is probably not the real content.
const MIN_ARTICLE_LENGTH = 500;

export interface WebPage {
  url: string;
  title: string | null;
  text: string;
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

async function assertPublicUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Only http(s) links can be loaded');
  }
  if (url.username || url.password) {
    throw new HttpError(400, 'Links with credentials cannot be loaded');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => {
    throw new HttpError(400, `Could not find ${url.hostname}`);
  });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new HttpError(400, 'This link points to a private address and cannot be loaded');
  }
}

// Redirects are followed by hand so every hop is checked against private addresses.
async function fetchPublic(startUrl: string): Promise<{ url: URL; response: Response }> {
  let url = new URL(startUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: 'text/html,text/plain;q=0.9',
        'User-Agent': 'Mozilla/5.0 (compatible; PodosphereBot/1.0)',
      },
    }).catch(() => {
      throw new HttpError(400, `Could not load ${url.hostname}`);
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      url = new URL(location, url);
      continue;
    }
    return { url, response };
  }

  throw new HttpError(400, 'The link redirects too many times');
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return '';
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel();

  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (!code.startsWith('#')) {
      return named[code.toLowerCase()] ?? entity;
    }
    const isHex = code[1] === 'x' || code[1] === 'X';
    const point = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(
        /<(script|style|noscript|svg|template|iframe|nav|footer|form)\b[\s\S]*?<\/\1>/gi,
        ' '
      )
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|tr|section|article|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractText(html: string): string {
  for (const tag of ['article', 'main']) {
    const block = html.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'i'))?.[0];
    const text = block ? htmlToText(block) : '';
    if (text.length >= MIN_ARTICLE_LENGTH) {
      return text;
    }
  }
  const body = html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html;
  return htmlToText(body);
}

// Loads a public web page and returns its readable text for the AI.
export async function fetchWebPage(url: string): Promise<WebPage> {
  const { url: finalUrl, response } = await fetchPublic(url);
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(400, `The page answered with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
    await response.body?.cancel();
    throw new HttpError(400, 'The link is not a web page');
  }

  const raw = await readLimited(response);
  const isHtml = !/text\/plain/i.test(contentType);
  const title = isHtml ? raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] : undefined;
  const text = (isHtml ? extractText(raw) : raw.trim()).slice(0, MAX_TEXT_LENGTH);

  if (!text) {
    throw new HttpError(400, 'No readable text was found on the page');
  }

  return {
    url: finalUrl.toString(),
    title: title ? decodeEntities(title).replace(/\s+/g, ' ').trim() || null : null,
    text,
  };
}
