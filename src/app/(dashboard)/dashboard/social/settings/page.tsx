import type { Metadata } from 'next';
import { ComingSoonSection } from '@/modules/social/components/coming-soon-section';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  return <ComingSoonSection section="settings" />;
}
