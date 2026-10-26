import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { bioPageService } from '@/modules/social/server/bio-pages/bio-page.service';
import type { PublicBioPage } from '@/modules/social/types/bio';

type Params = { params: Promise<{ slug: string }> };

// Public page: always rendered at request time against the database.
export const dynamic = 'force-dynamic';

const THEMES: Record<string, { page: string; card: string; title: string; sub: string; button: string }> = {
  light: {
    page: 'bg-neutral-100 text-neutral-900',
    card: '',
    title: 'text-neutral-900',
    sub: 'text-neutral-500',
    button: 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/5 hover:bg-neutral-50',
  },
  dark: {
    page: 'bg-neutral-950 text-neutral-50',
    card: '',
    title: 'text-neutral-50',
    sub: 'text-neutral-400',
    button: 'bg-neutral-800 text-neutral-50 ring-1 ring-white/10 hover:bg-neutral-700',
  },
  brand: {
    page: 'bg-gradient-to-b from-violet-600 to-fuchsia-600 text-white',
    card: '',
    title: 'text-white',
    sub: 'text-white/70',
    button: 'bg-white/15 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/25',
  },
};

function theme(name: string) {
  return THEMES[name] ?? THEMES.light;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const result = await bioPageService.getPublic(slug);
  if (!result) {
    return { title: 'Not found' };
  }
  return {
    title: result.page.title,
    description: result.page.headline ?? undefined,
    robots: { index: false },
  };
}

export default async function BioPage({ params }: Params) {
  const { slug } = await params;
  const result = await bioPageService.getPublic(slug);
  if (!result) {
    notFound();
  }

  const { id, page } = result;
  after(async () => {
    try {
      await bioPageService.recordView(id);
    } catch {
      // View counting must never break the page.
    }
  });

  return <BioPageView page={page} />;
}

function BioPageView({ page }: { page: PublicBioPage }) {
  const t = theme(page.theme);
  const initials = page.title.trim().slice(0, 1).toUpperCase() || '•';

  return (
    <main className={`flex min-h-full flex-1 flex-col items-center px-5 py-14 ${t.page}`}>
      <div className="flex w-full max-w-md flex-col items-center">
        {page.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.avatarUrl}
            alt=""
            className="h-24 w-24 rounded-full object-cover ring-2 ring-white/20"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-3xl font-semibold ring-2 ring-white/20">
            {initials}
          </div>
        )}

        <h1 className={`mt-5 text-center text-xl font-semibold ${t.title}`}>{page.title}</h1>
        {page.headline && <p className={`mt-1.5 text-center text-sm ${t.sub}`}>{page.headline}</p>}

        <nav className="mt-8 flex w-full flex-col gap-3">
          {page.links.length === 0 ? (
            <p className={`text-center text-sm ${t.sub}`}>No links yet.</p>
          ) : (
            page.links.map((link) => (
              <a
                key={link.id}
                href={`/bl/${link.id}`}
                target="_blank"
                rel="noopener nofollow"
                className={`block rounded-xl px-5 py-3.5 text-center text-sm font-medium transition ${t.button}`}
              >
                {link.label}
              </a>
            ))
          )}
        </nav>
      </div>
    </main>
  );
}
