import type { Metadata } from 'next';
import { AiProviderSettings } from '@/modules/social/components/ai/ai-provider-settings';
import { AiStudio } from '@/modules/social/components/ai/ai-studio';
import { BrandKitEditor } from '@/modules/social/components/ai/brand-kit-editor';
import { ContentStudio } from '@/modules/social/components/ai/content-studio';
import { CopilotPanel } from '@/modules/social/components/ai/copilot-panel';
import { WeeklyPlanButton } from '@/modules/social/components/ai/weekly-plan-button';
import { getAccess } from '@/shared/server/access';

export const metadata: Metadata = {
  title: 'Agent',
};

export default async function AiStudioPage() {
  // Provider + API key config is an agency-admin action, so only OWNER/ADMIN see the panel.
  const access = await getAccess().catch(() => null);
  const canManageProviders = access?.role === 'OWNER' || access?.role === 'ADMIN';

  return (
    <div className="space-y-5">
      <BrandKitEditor />
      {canManageProviders && <AiProviderSettings />}
      <WeeklyPlanButton />
      <ContentStudio />
      <CopilotPanel />
      <AiStudio />
    </div>
  );
}
