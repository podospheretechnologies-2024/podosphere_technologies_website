import 'server-only';
import { decodeEntities, htmlToText } from '@/shared/server/html-text';
import { HttpError } from '@/shared/server/http-error';
import { fetchPublicUrl, readTextLimited } from '@/shared/server/public-fetch';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DESCRIPTION_LENGTH = 2000;

export interface FeedItem {
  title: string;
  url: string;
  description: string;
}

export interface Feed {
  title: string | null;
  /** Newest first, as feeds list them. */
  items: FeedItem[];
}

function unwrapCdata(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

// Text of the first <tag> in `xml`; namespaced tags like "content:encoded" work too.
function readTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? unwrapCdata(match[1]).trim() : null;
}

function readAttribute(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null;
}

// RSS uses <link>url</link>; Atom uses <link href="url"/>, preferring rel="alternate".
function readLink(item: string): string | null {
  const text = readTag(item, 'link');
  if (text) {
    return decodeEntities(text);
  }
  const links = item.match(/<link\b[^>]*>/gi) ?? [];
  const alternate =
    links.find((link) => (readAttribute(link, 'rel') ?? 'alternate') === 'alternate') ?? links[0];
  const href = alternate ? readAttribute(alternate, 'href') : null;
  return href ? decodeEntities(href) : null;
}

function toText(value: string | null): string {
  return value ? htmlToText(decodeEntities(value)).replace(/\s+/g, ' ').trim() : '';
}

function parseItem(item: string, baseUrl: URL): FeedItem | null {
  const link = readLink(item);
  if (!link) {
    return null;
  }

  let url: string;
  try {
    url = new URL(link, baseUrl).toString();
  } catch {
    return null;
  }

  const description = toText(
    readTag(item, 'description') ??
      readTag(item, 'summary') ??
      readTag(item, 'content:encoded') ??
      readTag(item, 'content')
  );

  return {
    title: toText(readTag(item, 'title')) || url,
    url,
    description: description.slice(0, MAX_DESCRIPTION_LENGTH),
  };
}

export function parseFeed(xml: string, baseUrl: URL): Feed {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  if (blocks.length === 0 && !/<(rss|feed|rdf:RDF)\b/i.test(xml)) {
    throw new HttpError(400, 'The link is not an RSS or Atom feed');
  }

  const header = xml.split(/<item\b|<entry\b/i)[0];
  return {
    title: toText(readTag(header, 'title')) || null,
    items: blocks.flatMap((block) => parseItem(block, baseUrl) ?? []),
  };
}

export async function fetchFeed(url: string): Promise<Feed> {
  const { url: finalUrl, response } = await fetchPublicUrl(url, {
    headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(400, `The feed answered with status ${response.status}`);
  }
  return parseFeed(await readTextLimited(response, MAX_BYTES), finalUrl);
}
