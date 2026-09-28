import { NavLink } from '@/shared/components/layout/nav-link';
import { socialNavigation } from '../config/navigation';

export function SocialSectionNav() {
  return (
    <nav className="border-border mb-6 flex gap-6 overflow-x-auto border-b md:hidden">
      {socialNavigation.items.map((item) => (
        <NavLink key={item.href} href={item.href} label={item.label} variant="tab" />
      ))}
    </nav>
  );
}
