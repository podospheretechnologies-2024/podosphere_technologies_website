import type { Metadata } from 'next';
import { ComingSoonSection } from '@/modules/social/components/coming-soon-section';

export const metadata: Metadata = {
  title: 'AI Studio',
};

export default function AiStudioPage() {
  return <ComingSoonSection section="ai" />;
}
