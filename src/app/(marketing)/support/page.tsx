import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/modules/marketing/components/legal-page';
import { legal } from '@/modules/marketing/config/legal';

export const metadata: Metadata = { title: 'Support' };

/** Meta App settings → "Support URL" points here. */
export default function SupportPage() {
  return (
    <LegalPage
      title="Support"
      intro={<>How to get help with {legal.product}, report a problem or ask about your account and data.</>}
    >
      <section>
        <h2>Contact us</h2>
        <ul>
          <li>
            WhatsApp:{' '}
            <a href={legal.whatsappLink} className="text-primary hover:underline">
              {legal.whatsappNumber}
            </a>
          </li>
          <li>
            Email: <strong>{legal.contactEmail}</strong>
          </li>
          <li>Hours: {legal.supportHours}. We reply within one business day.</li>
        </ul>
        <p>
          Include your workspace name and, for a problem, what you were doing and any error message you saw. Never
          send passwords or access tokens.
        </p>
      </section>

      <section>
        <h2>Connected accounts</h2>
        <ul>
          <li>
            <strong>Connect a Facebook Page, Instagram account or WhatsApp number:</strong> log in and open{' '}
            <strong>Dashboard → Social Media → Channels</strong>, then follow the Meta login steps.
          </li>
          <li>
            <strong>A channel stopped publishing:</strong> its access may have expired or been removed on Facebook.
            Reconnect it from Channels.
          </li>
          <li>
            <strong>Disconnect an account:</strong> click the delete icon next to it in Channels. Its access tokens
            are deleted immediately.
          </li>
        </ul>
      </section>

      <section>
        <h2>Your data</h2>
        <p>
          To delete your data or remove {legal.product} from Facebook, follow the{' '}
          <Link href="/data-deletion" className="text-primary hover:underline">
            data deletion instructions
          </Link>
          . How we handle your data is described in our{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </section>

      <section>
        <h2>Billing and your plan</h2>
        <p>
          For invoices, plan changes or cancellation, message us on WhatsApp or email us from your account&apos;s
          email address.
        </p>
      </section>
    </LegalPage>
  );
}
