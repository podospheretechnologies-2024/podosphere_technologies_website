import type { Metadata } from 'next';
import { WhatsAppPanel } from '@/modules/social/components/whatsapp/whatsapp-panel';
import { socialSections } from '@/modules/social/config/navigation';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = {
  title: 'WhatsApp',
};

export default function WhatsAppPage() {
  const { label, description } = socialSections.whatsapp;

  return (
    <div className="space-y-5">
      <PageHeader title={label} description={description} />
      <WhatsAppPanel />
    </div>
  );
}
