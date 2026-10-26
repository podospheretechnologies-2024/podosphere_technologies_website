import { after, NextResponse } from 'next/server';
import { bioPageService } from '@/modules/social/server/bio-pages/bio-page.service';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const trimmed = id?.trim();
  if (!trimmed) {
    return new NextResponse('Not found', { status: 404 });
  }

  const destination = await bioPageService.resolveRedirect(trimmed);
  if (!destination) {
    return new NextResponse('Not found', { status: 404 });
  }

  after(async () => {
    try {
      await bioPageService.recordClick(trimmed);
    } catch {
      // Click logging must never break the redirect.
    }
  });

  return NextResponse.redirect(destination, 302);
}
