import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/modules/marketing/components/legal-page';
import { legal } from '@/modules/marketing/config/legal';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <>
          This policy explains what data {legal.product} (operated by {legal.company}) collects, why, and the choices
          you have. {legal.product} helps businesses and agencies plan, publish and analyse social media content and
          manage messages, leads and ads across Facebook, Instagram, WhatsApp, LinkedIn, YouTube and Google Business
          Profile.
        </>
      }
    >
      <section>
        <h2>1. Data we collect</h2>
        <ul>
          <li><strong>Account data:</strong> your name, email address, workspace name and a hashed password.</li>
          <li>
            <strong>Connected platform data:</strong> when you connect a Facebook Page, Instagram business account or
            other channel, we receive the account&apos;s ID, name and profile picture, access tokens, and the content
            you ask us to manage: posts, comments, direct messages, reviews, lead-form responses, page and ad insights,
            and ad campaign details.
          </li>
          <li><strong>Content you create:</strong> post drafts, media, schedules, brand kit details and replies.</li>
          <li><strong>Usage data:</strong> log data such as IP address, browser type and actions in the app, used for security and support.</li>
        </ul>
      </section>

      <section>
        <h2>2. How we use it</h2>
        <ul>
          <li>To publish and schedule content, show analytics, and run the unified inbox, leads and ads features you use.</li>
          <li>
            To power Podo AI features (for example writing captions or drafting replies). The relevant content is sent
            to our AI provider, Anthropic, to generate a response. It is not used to train their models.
          </li>
          <li>To keep the service secure, prevent abuse, provide support, and meet legal obligations.</li>
        </ul>
        <p>We do not sell personal data, and we do not use data from Meta platforms for advertising profiles or resale.</p>
      </section>

      <section>
        <h2>3. Sharing</h2>
        <p>We share data only with:</p>
        <ul>
          <li>The platforms you connect (for example Meta), to carry out the actions you request.</li>
          <li>Service providers that host or process data for us (cloud hosting, database, AI processing), under contract.</li>
          <li>Your own CRM, if you turn on lead sync.</li>
          <li>Authorities, when required by law.</li>
        </ul>
      </section>

      <section>
        <h2>4. Security and retention</h2>
        <p>
          Platform access tokens are encrypted at rest (AES-256-GCM) and never shown in the app. Data is kept while your
          workspace is active. When you disconnect an account, its tokens are deleted. When you delete your workspace or
          ask us to, we delete the associated data within 30 days, except where we must keep records by law.
        </p>
      </section>

      <section>
        <h2>5. Your rights</h2>
        <p>
          Under applicable law, including India&apos;s Digital Personal Data Protection Act, 2023, you can ask to access,
          correct or delete your personal data, and withdraw consent. See{' '}
          <Link href="/data-deletion" className="text-primary underline">
            how to delete your data
          </Link>
          , or contact us at {legal.contactEmail}.
        </p>
      </section>

      <section>
        <h2>6. Contact</h2>
        <p>
          {legal.company}, {legal.address}. Email: {legal.contactEmail}. We may update this policy; the date at the top
          shows the latest version.
        </p>
      </section>
    </LegalPage>
  );
}
