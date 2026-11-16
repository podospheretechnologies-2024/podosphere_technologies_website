import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FinalCta } from '@/modules/marketing/components/final-cta';
import { FOR_PAGES, type ForSlug } from '@/modules/marketing/config/seo-pages';
import { SITE_URL } from '@/modules/marketing/config/site';

export function generateStaticParams() {
  return Object.keys(FOR_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = FOR_PAGES[slug as ForSlug];
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `${SITE_URL}/for/${page.slug}` },
  };
}

export default async function ForAudiencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = FOR_PAGES[slug as ForSlug];
  if (!page) notFound();

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-32 pb-16">
        <p className="text-muted-foreground text-sm">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>{' '}
          / For
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          {page.headline}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
          {page.description}
        </p>
        <ul className="mt-10 max-w-2xl space-y-3">
          {page.points.map((point) => (
            <li key={point} className="border-border bg-surface rounded-xl border px-4 py-3 text-sm">
              {point}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-medium"
          >
            Start free
          </Link>
          <Link href="/pricing" className="border-border rounded-xl border bg-surface px-6 py-3 text-sm font-medium">
            See pricing
          </Link>
        </div>
      </section>
      <FinalCta />
    </>
  );
}
