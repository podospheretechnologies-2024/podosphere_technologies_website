import 'server-only';
import { decodeEntities, htmlToText } from '@/shared/server/html-text';
import { HttpError } from '@/shared/server/http-error';
import { fetchPublicUrl, readTextLimited } from '@/shared/server/public-fetch';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_LENGTH = 20_000;
// An <article>/<main> block shorter than this is probably not the real content.
const MIN_ARTICLE_LENGTH = 500;

export interface WebPage {
  url: string;
  title: string | null;
  text: string;
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
  const { url: finalUrl, response } = await fetchPublicUrl(url, {
    headers: { Accept: 'text/html,text/plain;q=0.9' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(400, `The page answered with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
    await response.body?.cancel();
    throw new HttpError(400, 'The link is not a web page');
  }

  const raw = await readTextLimited(response, MAX_BYTES);
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
