import Link from 'next/link';
import type { Metadata } from 'next';
import { Reveal, Stagger, StaggerItem } from '@/shared/components/motion/reveal';
import type { FeaturePageContent } from '../config/features';
import { SITE_URL } from '../config/site';
import { FaqSection } from './faq-section';
import { FinalCta } from './final-cta';

export type { FeaturePageContent };

export function featureMetadata(content: FeaturePageContent): Metadata {
  return {
    title: content.title,
    description: content.description,
    alternates: { canonical: `${SITE_URL}/features/${content.slug}` },
    openGraph: {
      title: content.title,
      description: content.description,
      url: `${SITE_URL}/features/${content.slug}`,
      type: 'website',
    },
  };
}

export function FeaturePage({ content }: { content: FeaturePageContent }) {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-32 pb-16">
        <Reveal>
          <p className="text-muted-foreground text-sm">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <span className="mx-2">/</span>
            Features
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            {content.headline}
          </h1>
          <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
            {content.sub}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90"
            >
              Start free
            </Link>
            <Link
              href="/pricing"
              className="border-border hover:bg-surface-muted rounded-xl border bg-surface px-6 py-3 text-sm font-medium"
            >
              See pricing
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <Stagger className="grid gap-6 md:grid-cols-2">
          {content.blocks.map((block) => (
            <StaggerItem
              key={block.title}
              className="border-border bg-surface rounded-2xl border p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight">{block.title}</h2>
                {block.tag ? (
                  <span className="rounded-full bg-[#F7F7F5] px-2 py-0.5 text-[11px] font-medium text-[#5C5C5C]">
                    {block.tag}
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{block.text}</p>
              <div className="border-border mt-6 rounded-xl border border-dashed bg-[#F7F7F5] px-4 py-10 text-center text-xs text-[#8A8A8A]">
                Product screenshot — add from staging
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="bg-surface border-y border-[#E8E8E4] py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {content.howItWorks.map((step, i) => (
              <li key={step.title} className="border-border rounded-2xl border p-5">
                <span className="text-primary text-sm font-semibold tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {content.faq?.length ? <FaqSection items={content.faq} title="FAQ" /> : null}
      <FinalCta />
    </>
  );
}
