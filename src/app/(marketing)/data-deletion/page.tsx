import type { Metadata } from 'next';
import { LegalPage } from '@/modules/marketing/components/legal-page';
import { legal } from '@/modules/marketing/config/legal';

export const metadata: Metadata = { title: 'Data Deletion' };

/** Meta App settings → "Data deletion instructions URL" points here. */
export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Data Deletion Instructions"
      intro={<>How to remove {legal.product}&apos;s access to your accounts and ask us to delete your data.</>}
    >
      <section>
        <h2>Disconnect an account inside {legal.product}</h2>
        <ol>
          <li>Log in and open <strong>Dashboard → Social Media → Channels</strong>.</li>
          <li>Click the delete icon next to the Page or account and confirm.</li>
          <li>Its access tokens are deleted immediately, and we stop reading or publishing to it.</li>
        </ol>
      </section>

      <section>
        <h2>Remove the app from Facebook</h2>
        <ol>
          <li>On Facebook, go to <strong>Settings &amp; privacy → Settings → Business integrations</strong> (or Apps and websites).</li>
          <li>Find <strong>{legal.product}</strong> and click <strong>Remove</strong>.</li>
          <li>Optionally tick the box to delete posts, photos or videos the app published on your behalf.</li>
        </ol>
      </section>

      <section>
        <h2>Delete all your data</h2>
        <p>
          Email <strong>{legal.contactEmail}</strong> from your account&apos;s email address with the subject
          &ldquo;Data deletion request&rdquo; and your workspace name. We confirm the request and delete your account,
          workspace, connected accounts, posts, messages, leads and analytics within <strong>30 days</strong>, except
          records we must keep by law. We&apos;ll email you when it&apos;s done.
        </p>
      </section>
    </LegalPage>
  );
}
