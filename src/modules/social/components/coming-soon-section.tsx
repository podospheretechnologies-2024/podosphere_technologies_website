import { EmptyState } from '@/shared/components/ui/empty-state';
import { PageHeader } from '@/shared/components/ui/page-header';
import { socialSections, type SocialSectionKey } from '../config/navigation';

interface ComingSoonSectionProps {
  section: SocialSectionKey;
}

export function ComingSoonSection({ section }: ComingSoonSectionProps) {
  const { label, description } = socialSections[section];

  return (
    <>
      <PageHeader title={label} description={description} />
      <EmptyState
        title="This section is being built"
        description="This part of the social media module will be available in an upcoming release."
      />
    </>
  );
}
