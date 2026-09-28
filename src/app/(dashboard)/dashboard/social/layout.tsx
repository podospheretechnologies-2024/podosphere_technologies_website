import { SocialSectionNav } from '@/modules/social/components/social-section-nav';

export default function SocialLayout({ children }: LayoutProps<'/dashboard/social'>) {
  return (
    <>
      <SocialSectionNav />
      {children}
    </>
  );
}
