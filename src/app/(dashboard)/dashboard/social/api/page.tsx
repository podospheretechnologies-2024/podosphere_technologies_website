import type { Metadata } from 'next';
import { ApiClientsPanel } from '@/modules/social/components/api/api-clients-panel';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = { title: 'API' };

export default function ApiClientsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Public API" description="Keys for /api/v1. The full key is shown once. Agency Pro includes this." />
      <ApiClientsPanel />
    </div>
  );
}
