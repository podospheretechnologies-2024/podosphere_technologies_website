import { redirect } from 'next/navigation';
import { socialAppHome } from '@/modules/social/config/app-nav';

export default function DashboardPage() {
  redirect(socialAppHome);
}
