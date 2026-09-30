import type { Metadata } from 'next';
import { AutomationPanel } from '@/modules/social/components/automation/automation-panel';

export const metadata: Metadata = {
  title: 'Plugs',
};

export default function AutomationPage() {
  return <AutomationPanel />;
}
