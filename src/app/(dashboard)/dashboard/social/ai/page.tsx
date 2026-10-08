import type { Metadata } from 'next';
import { AiStudio } from '@/modules/social/components/ai/ai-studio';
import { BrandKitEditor } from '@/modules/social/components/ai/brand-kit-editor';
import { CopilotPanel } from '@/modules/social/components/ai/copilot-panel';

export const metadata: Metadata = {
  title: 'Agent',
};

export default function AiStudioPage() {
  return (
    <div className="space-y-5">
      <BrandKitEditor />
      <CopilotPanel />
      <AiStudio />
    </div>
  );
}
