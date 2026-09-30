import type { Metadata } from 'next';
import { AiStudio } from '@/modules/social/components/ai/ai-studio';

export const metadata: Metadata = {
  title: 'Agent',
};

export default function AiStudioPage() {
  return <AiStudio />;
}
