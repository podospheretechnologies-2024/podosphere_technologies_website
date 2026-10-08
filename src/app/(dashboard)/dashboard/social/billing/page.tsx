import type { Metadata } from 'next';
import Script from 'next/script';
import { BillingPanel } from '@/modules/social/components/billing/billing-panel';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = { title: 'Billing' };

export default function BillingPage() {
  return (
    <div className="space-y-5">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <PageHeader title="Billing" description="Razorpay plans. Limits apply to channels, clients and users." />
      <BillingPanel />
    </div>
  );
}
