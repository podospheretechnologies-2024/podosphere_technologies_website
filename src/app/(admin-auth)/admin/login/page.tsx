import { redirect } from 'next/navigation';
import { AdminLoginForm } from '@/modules/admin/components/admin-login-form';
import { getCurrentUser } from '@/modules/auth/server/session';

export const metadata = { title: 'Super Admin login' };

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user?.isPlatformAdmin) redirect('/admin');
  if (user) redirect('/dashboard');

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Super Admin</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900">Log in</h1>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        Use your Podo Social account. Admins stay on this side; other users go to the workspace.
      </p>
      <AdminLoginForm />
    </div>
  );
}
