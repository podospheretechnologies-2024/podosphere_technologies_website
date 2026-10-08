import { requirePlatformAdmin } from '@/shared/server/access';
import { adminService } from '@/modules/admin/server/admin.service';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Platform Health | PodoSphere' };

export default async function SuperAdminPage() {
  await requirePlatformAdmin();

  const [organizations, syncFails, aiUsage] = await Promise.all([
    adminService.listOrganizations(),
    adminService.getSyncHealth(),
    adminService.getAiUsage(),
  ]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-6">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 tracking-tight">Super Admin Platform</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Agencies</h2>
          <div className="text-4xl font-bold text-gray-900">{organizations.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Failing Syncs</h2>
          <div className="text-4xl font-bold text-red-600">{syncFails.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">AI Cost Monitored</h2>
          <div className="text-4xl font-bold text-blue-600">{aiUsage.length} orgs</div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-4">Organizations (Agencies)</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-12">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clients</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {organizations.map((org) => (
              <tr key={org.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{org.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{org._count.users}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{org._count.socialCustomers}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{org.createdAt.toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-indigo-600 hover:text-indigo-900">Impersonate Owner</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-4">Sync Health Board</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {syncFails.length === 0 ? (
          <div className="p-8 text-center text-gray-500">All synchronization jobs are perfectly healthy.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kind</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Integration / Ad Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Failures</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Error</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {syncFails.map((fail) => (
                <tr key={fail.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{fail.kind}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">{fail.integrationId || fail.adAccountId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-bold">{fail.failures}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{fail.lastError}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
