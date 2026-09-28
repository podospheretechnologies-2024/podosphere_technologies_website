import type { Metadata } from 'next';
import { SettingsPanel } from '@/modules/social/components/settings/settings-panel';
import { socialSections } from '@/modules/social/config/navigation';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  const { label, description } = socialSections.settings;

  return (
    <>
      <PageHeader title={label} description={description} />
      <SettingsPanel />
    </>
  );
}
