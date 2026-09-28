import type { Metadata } from 'next';
import { AutomationPanel } from '@/modules/social/components/automation/automation-panel';
import { socialSections } from '@/modules/social/config/navigation';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Automation',
};

export default function AutomationPage() {
  const { label, description } = socialSections.automation;

  return (
    <>
      <PageHeader title={label} description={description} />
      <AutomationPanel />
    </>
  );
}
