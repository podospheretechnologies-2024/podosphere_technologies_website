import { SignaturesCard } from './signatures-card';
import { TagsCard } from './tags-card';
import { TemplatesCard } from './templates-card';

export function SettingsPanel() {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <SignaturesCard />
        <TemplatesCard />
      </div>
      <TagsCard />
    </div>
  );
}
