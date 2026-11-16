import type { Metadata } from 'next';
import { AdChatsCard } from '@/modules/social/components/whatsapp/ad-chats-card';
import { AgencyNotifyCard } from '@/modules/social/components/whatsapp/agency-notify-card';
import { AutoRepliesCard } from '@/modules/social/components/whatsapp/auto-replies-card';
import { LeadFlowCard } from '@/modules/social/components/whatsapp/lead-flow-card';
import { WhatsAppGrowthTools } from '@/modules/social/components/whatsapp/whatsapp-growth-tools';
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
      <WhatsAppGrowthTools />
      <LeadFlowCard />
      <AgencyNotifyCard />
      <AdChatsCard />
      <AutoRepliesCard />
      <WhatsAppPanel />
    </div>
  );
}
