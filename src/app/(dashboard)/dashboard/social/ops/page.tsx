import type { Metadata } from 'next';
import { ClientDesk } from '@/modules/social/components/ops/client-desk';

export const metadata: Metadata = { title: 'Client Desk | Client Ops' };

export default function ClientOpsPage() {
  return <ClientDesk />;
}
