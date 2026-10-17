import type { Metadata } from 'next';
import { LegalPage } from '@/modules/marketing/components/legal-page';
import { legal } from '@/modules/marketing/config/legal';
import { DataDeletionRequestForm } from '@/modules/marketing/components/data-deletion-request-form';
import { prisma } from '@/shared/lib/prisma';

export const metadata: Metadata = { title: 'Data Deletion' };

/**
 * Meta App settings → "Data deletion instructions URL" points here.
 * Callback (/api/meta/data-deletion) links users here with ?code= for status.
 */
export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const statusRow = code
    ? await prisma.dataDeletionRequest.findUnique({
        where: { confirmationCode: code },
        select: { confirmationCode: true, status: true, createdAt: true, completedAt: true },
      })
    : null;

  return (
    <LegalPage
      title="Data Deletion Instructions"
      intro={<>How to remove {legal.product}&apos;s access to your accounts and ask us to delete your data.</>}
    >
      {code && (
        <section>
          <h2>Request status</h2>
          {statusRow ? (
            <ul>
              <li>
                Confirmation code: <strong>{statusRow.confirmationCode}</strong>
              </li>
              <li>
                Status: <strong>{statusRow.status}</strong>
              </li>
              <li>Received: {statusRow.createdAt.toISOString().slice(0, 10)}</li>
              {statusRow.completedAt && (
                <li>Completed: {statusRow.completedAt.toISOString().slice(0, 10)}</li>
              )}
            </ul>
          ) : (
            <p>
              We could not find a request for code <strong>{code}</strong>. If Facebook just showed you this
              code, wait a minute and refresh, or email <strong>{legal.contactEmail}</strong> with the code.
            </p>
          )}
        </section>
      )}

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
        <h2>Requests made from Facebook</h2>
        <p>
          When you remove {legal.product} from Facebook, Facebook sends us a deletion request and shows you a
          confirmation code linking to this page. That code means we received your request: we delete the data we
          hold for your Facebook account within <strong>30 days</strong>. Email <strong>{legal.contactEmail}</strong>{' '}
          with the code if you have questions about its status.
        </p>
      </section>

      <section>
        <h2>Delete all your data</h2>
        <p>
          Submit the form below, or email <strong>{legal.contactEmail}</strong> from your account&apos;s email
          address with the subject &ldquo;Data deletion request&rdquo; and your workspace name. We confirm the
          request and delete your account, workspace, connected accounts, posts, messages, leads and analytics
          within <strong>30 days</strong>, except records we must keep by law. We&apos;ll email you when it&apos;s
          done.
        </p>
        <DataDeletionRequestForm />
      </section>
    </LegalPage>
  );
}
