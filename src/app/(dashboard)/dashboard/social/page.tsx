import { redirect } from 'next/navigation';
import { socialSections } from '@/modules/social/config/navigation';

export default function SocialIndexPage() {
  redirect(socialSections.calendar.href);
}
