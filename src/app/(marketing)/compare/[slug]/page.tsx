import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FinalCta } from '@/modules/marketing/components/final-cta';
import { COMPARE_PAGES, type CompareSlug } from '@/modules/marketing/config/seo-pages';
import { SITE_URL } from '@/modules/marketing/config/site';

export function generateStaticParams() {
  return Object.keys(COMPARE_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = COMPARE_PAGES[slug as CompareSlug];
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `${SITE_URL}/compare/${page.slug}` },
  };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = COMPARE_PAGES[slug as CompareSlug];
  if (!page) notFound();

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-32 pb-16">
        <p className="text-muted-foreground text-sm">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>{' '}
          / Compare
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          {page.headline}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
          {page.description}
        </p>
        <p className="text-muted-foreground mt-3 text-xs">
          Comparisons are honest summaries, not paid placements. Features change — verify on each
          vendor’s site before buying.
        </p>

        <div className="border-border mt-10 overflow-x-auto rounded-2xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-muted/60 text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Capability</th>
                <th className="px-4 py-3 capitalize">{page.slug}</th>
                <th className="px-4 py-3">Podo Social</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {page.rows.map(([cap, them, us]) => (
                <tr key={cap}>
                  <td className="px-4 py-3 font-medium">{cap}</td>
                  <td className="text-muted-foreground px-4 py-3">{them}</td>
                  <td className="px-4 py-3">{us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <FinalCta title="Try Podo Social for your agency" />
    </>
  );
}
