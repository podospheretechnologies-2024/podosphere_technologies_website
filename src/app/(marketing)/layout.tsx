import { Plus_Jakarta_Sans } from 'next/font/google';
import { MarketingFooter } from '@/modules/marketing/components/marketing-footer';
import { MarketingNav } from '@/modules/marketing/components/marketing-nav';
import { SITE_URL } from '@/modules/marketing/config/site';

const marketingSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-marketing',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Podo Social — Agency social media software for India',
    template: '%s | Podo Social',
  },
  description:
    'Plan, publish, reply, track ads and report for every client from one place. Built for Indian agencies with WhatsApp, Razorpay and GST invoices.',
};

export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <div
      className={`${marketingSans.variable} theme-marketing flex min-h-screen flex-col font-[family-name:var(--font-marketing),var(--font-geist-sans),sans-serif]`}
    >
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
