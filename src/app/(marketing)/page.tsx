import Link from 'next/link';
import { ArrowRight, Bot, CheckCircle2 } from 'lucide-react';
import { FaqSection } from '@/modules/marketing/components/faq-section';
import { FinalCta } from '@/modules/marketing/components/final-cta';
import { HeroVisual } from '@/modules/marketing/components/hero-visual';
import { PricingGrid } from '@/modules/marketing/components/pricing-grid';
import { legal } from '@/modules/marketing/config/legal';
import {
  API_BASE_URL,
  FAQ_ITEMS,
  FEATURE_PILLARS,
  INDIA_EDGE,
  PLATFORMS,
  SITE_URL,
} from '@/modules/marketing/config/site';
import { Reveal, Stagger, StaggerItem } from '@/shared/components/motion/reveal';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'Podo Social',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'INR',
        lowPrice: '1499',
        highPrice: '19999',
      },
      provider: {
        '@type': 'Organization',
        name: legal.company,
        url: SITE_URL,
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ],
};

const steps = [
  { title: 'Connect', text: 'Link Pages, Instagram, WhatsApp, Shopify, GA4 and ad accounts.' },
  { title: 'Teach', text: 'Fill the brand kit: voice, audience, words to avoid, FAQs.' },
  { title: 'Approve', text: 'Podo AI drafts posts, replies and ad changes. You approve with one click.' },
];

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="relative flex min-h-[90vh] items-center overflow-hidden pt-28 pb-16">
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
          <div>
            <Reveal>
              <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight md:text-5xl lg:text-[3.4rem]">
                Social ops for Indian agencies — publish, reply, ads and reports in one desk.
              </h1>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
                Plan, publish, reply, track ads and report for every client, from one place. Made for
                Indian agencies.
              </p>
            </Reveal>
            <Reveal delay={0.16} className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90"
              >
                Start free
              </Link>
              <a
                href={legal.whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="border-border bg-surface hover:bg-surface-muted rounded-xl border px-6 py-3 text-sm font-medium"
              >
                Book a WhatsApp demo
              </a>
            </Reveal>
            <Reveal delay={0.24}>
              <p className="text-muted-foreground mt-10 text-xs font-medium tracking-wide uppercase">
                Platforms
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <span
                    key={p}
                    className="border-border bg-surface rounded-full border px-3 py-1 text-xs font-medium"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.12}>
            <HeroVisual />
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20" id="features">
        <Reveal className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Everything you run for clients, in six desks.
          </h2>
          <p className="text-muted-foreground mt-4">
            Each pillar opens a full feature page. Forty-plus capabilities are already shipping —
            not a teaser list of six.
          </p>
        </Reveal>
        <Stagger className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURE_PILLARS.map((f) => (
            <StaggerItem key={f.href}>
              <Link
                href={f.href}
                className="border-border bg-surface hover:border-foreground/20 group flex h-full flex-col rounded-2xl border p-6 transition"
              >
                <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">{f.text}</p>
                <span className="text-primary mt-5 inline-flex items-center gap-1 text-sm font-medium">
                  Explore <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="bg-foreground text-background py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
            Made for India — the edge over Buffer and Hootsuite.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {INDIA_EDGE.map((item) => (
              <div key={item.title}>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="agent" className="py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Podo AI drafts. You approve. Nothing ships alone.
            </h2>
            <ol className="mt-10 space-y-6">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="text-muted-foreground text-sm">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="text-muted-foreground mt-8 text-sm">
              Prefer a walkthrough?{' '}
              <a href={legal.whatsappLink} className="text-foreground underline underline-offset-2">
                Book a WhatsApp demo
              </a>{' '}
              — product demo video coming soon.
            </p>
          </Reveal>
          <Reveal delay={0.12} className="border-border bg-surface rounded-3xl border p-6 shadow-sm">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Bot className="size-4" /> Podo AI · Approval queue
            </div>
            <div className="mt-5 space-y-3">
              {[
                ['Instagram post for Tue 7:30 PM', 'Diwali offer carousel, 3 captions drafted'],
                [
                  'Reply to comment on “Seed Funding”',
                  '“Thanks! DM us your city and we’ll share the details.”',
                ],
                ['Pause ad set “Retargeting 30d”', 'CTR fell 42% in 5 days: creative fatigue'],
              ].map(([title, text]) => (
                <div key={title} className="border-border bg-background rounded-2xl border p-4">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-muted-foreground mt-1 text-sm">{text}</p>
                  <div className="mt-3 flex gap-2 text-xs">
                    <span className="bg-success/15 text-success inline-flex items-center gap-1 rounded-lg px-2 py-1">
                      <CheckCircle2 className="size-3.5" /> Approve
                    </span>
                    <span className="bg-surface-muted text-muted-foreground rounded-lg px-2 py-1">
                      Edit
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-[#E8E8E4] bg-surface py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Built for agencies</h2>
          <p className="text-muted-foreground mt-4 max-w-2xl">
            Client workspaces, per-client brand kits, Owner / Admin / Member roles, a client portal,
            and white-label with a custom domain.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Client workspaces',
                text: 'Switch clients without losing context. Templates speed up onboarding.',
                href: '/features/agency',
              },
              {
                title: 'Client portal',
                text: 'Clients log in to approve content and download reports — only their data.',
                href: '/features/client-portal',
              },
              {
                title: 'White-label',
                text: 'Portal title, brand colour and custom domain so it feels like your product.',
                href: '/features/agency',
              },
            ].map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="border-border hover:border-foreground/20 rounded-2xl border p-6 transition"
              >
                <h3 className="font-semibold">{card.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{card.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Public API</h2>
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              Agency Pro keys (`ps_live_…`) with permissions, IP allowlists and daily limits. Create
              keys in Dashboard → Social → API.
            </p>
            <Link
              href="/docs/api"
              className="text-primary mt-6 inline-flex items-center gap-1 text-sm font-medium"
            >
              Read the API docs <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <pre className="border-border overflow-x-auto rounded-2xl border bg-[#111111] p-5 text-xs leading-relaxed text-white/85">
            {`curl -X POST ${API_BASE_URL}/posts \\
  -H "Authorization: Bearer ps_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "integrationId": "int_123",
    "content": "Diwali sale is live",
    "publishAt": "2026-11-20T13:30:00.000Z"
  }'`}
          </pre>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Pricing</h2>
            <p className="text-muted-foreground mt-3 text-sm">
              Four plans in INR. GST invoices included.
            </p>
          </div>
          <Link href="/pricing" className="text-primary text-sm font-medium">
            Full pricing →
          </Link>
        </div>
        <PricingGrid showCta={false} />
      </section>

      <FaqSection />
      <FinalCta />
    </>
  );
}
