import type { Metadata } from 'next';
import { ComingSoonSection } from '@/modules/social/components/coming-soon-section';

export const metadata: Metadata = {
  title: 'Automation',
};

export default function AutomationPage() {
  return <ComingSoonSection section="automation" />;
}
