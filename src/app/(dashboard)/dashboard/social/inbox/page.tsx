import type { Metadata } from 'next';
import { InboxPanel } from '@/modules/social/components/inbox/inbox-panel';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = { title: 'Inbox' };

export default function InboxPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Inbox" description="Facebook Page and Instagram messages and comments from the Meta webhook." />
      <InboxPanel />
    </div>
  );
}
