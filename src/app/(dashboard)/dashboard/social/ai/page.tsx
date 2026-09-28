import type { Metadata } from 'next';
import { AiStudio } from '@/modules/social/components/ai/ai-studio';
import { socialSections } from '@/modules/social/config/navigation';
import { PageHeader } from '@/shared/components/ui/page-header';

export const metadata: Metadata = {
  title: 'AI Studio',
};

export default function AiStudioPage() {
  const { label, description } = socialSections.ai;

  return (
    <>
      <PageHeader title={label} description={description} />
      <AiStudio />
    </>
  );
}
