import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/modules/marketing/components/legal-page';
import { legal } from '@/modules/marketing/config/legal';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <>
          These terms govern your use of {legal.product}, provided by {legal.company}. By creating an account or using
          the service, you agree to them.
        </>
      }
    >
      <section>
        <h2>1. The service</h2>
        <p>
          {legal.product} lets you connect social media accounts, create and schedule content, view analytics, manage
          messages, leads and ads, and use AI assistance (Podo AI). Features may change as we improve the product.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <ul>
          <li>Keep your login details safe. You are responsible for activity in your workspace.</li>
          <li>You may only connect accounts, Pages and ad accounts you are authorised to manage.</li>
          <li>You must follow the terms and policies of each connected platform (for example Meta&apos;s Platform Terms and Community Standards).</li>
        </ul>
      </section>

      <section>
        <h2>3. Content and AI</h2>
        <ul>
          <li>You own the content you create and publish. You give us permission to process it to provide the service.</li>
          <li>
            Podo AI suggestions can be wrong. Review AI-generated posts, replies and ad recommendations before approving
            them. Actions that publish content or change ads require your approval unless you turn on autopilot.
          </li>
          <li>Do not use the service for spam, misleading ads, unlawful content, or to harass anyone.</li>
        </ul>
      </section>

      <section>
        <h2>4. Fees</h2>
        <p>Paid plans, if any, are billed as described at purchase. Ad spend is paid directly to the ad platforms.</p>
      </section>

      <section>
        <h2>5. Availability and liability</h2>
        <p>
          We work to keep the service reliable but provide it &ldquo;as is&rdquo;. Third-party platforms may change or
          limit their APIs. To the extent the law allows, {legal.company} is not liable for indirect losses, lost
          profits, or outcomes of ads and posts you approve.
        </p>
      </section>

      <section>
        <h2>6. Ending use</h2>
        <p>
          You can stop using the service at any time and ask us to delete your data (see{' '}
          <Link href="/data-deletion" className="text-primary underline">
            Data deletion
          </Link>
          ). We may suspend accounts that break these terms.
        </p>
      </section>

      <section>
        <h2>7. Law and contact</h2>
        <p>
          These terms are governed by the laws of {legal.jurisdiction}. Questions: {legal.contactEmail}. See also our{' '}
          <Link href="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  );
}
