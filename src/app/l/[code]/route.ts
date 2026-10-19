import { after, NextResponse } from 'next/server';
import {
  buildDestinationUrl,
  shortLinkService,
} from '@/modules/social/server/short-links/short-link.service';

type Context = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: Context) {
  const { code } = await context.params;
  const trimmed = code?.trim();
  if (!trimmed) {
    return new NextResponse('Not found', { status: 404 });
  }

  const link = await shortLinkService.resolveByCode(trimmed);
  if (!link) {
    return new NextResponse('Not found', { status: 404 });
  }

  const destination = buildDestinationUrl(link);
  const linkId = link.id;

  after(async () => {
    try {
      await shortLinkService.recordClick(linkId);
    } catch {
      // Click logging must never break the redirect.
    }
  });

  return NextResponse.redirect(destination, 302);
}
