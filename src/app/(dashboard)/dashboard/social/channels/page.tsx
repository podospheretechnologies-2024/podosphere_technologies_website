import type { Metadata } from 'next';
import { ComingSoonSection } from '@/modules/social/components/coming-soon-section';

export const metadata: Metadata = {
  title: 'Channels',
};

export default function ChannelsPage() {
  return <ComingSoonSection section="channels" />;
}
