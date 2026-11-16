import type { Metadata } from 'next';
import { FaqSection } from '@/modules/marketing/components/faq-section';
import { FinalCta } from '@/modules/marketing/components/final-cta';
import { PricingGrid } from '@/modules/marketing/components/pricing-grid';
import { FAQ_ITEMS, SITE_URL } from '@/modules/marketing/config/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Podo Social plans in INR: Solo, Agency Starter, Agency Growth and Agency Pro. GST invoices included. WhatsApp template messages billed separately at Meta’s rate.',
  alternates: { canonical: `${SITE_URL}/pricing` },
};

const pricingFaq = FAQ_ITEMS.filter((item) =>
  /platforms|approval|clients log|API|GST|WhatsApp broadcasts|support/i.test(item.q)
);

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pt-32 pb-12">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
          Pricing for Indian agencies
        </h1>
        <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-relaxed">
          Four plans billed in ₹ via Razorpay. Prices below are exclusive of GST; each card shows
          the total with 18% GST. Plan limits and features come from the same config as billing —
          they cannot drift.
        </p>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <PricingGrid />
      </section>
      <FaqSection items={pricingFaq} title="Pricing FAQ" />
      <FinalCta title="Pick a plan and start free" />
    </>
  );
}
