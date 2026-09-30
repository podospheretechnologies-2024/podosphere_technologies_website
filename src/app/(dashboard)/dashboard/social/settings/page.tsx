import type { Metadata } from 'next';
import { SettingsPanel } from '@/modules/social/components/settings/settings-panel';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  return <SettingsPanel />;
}
