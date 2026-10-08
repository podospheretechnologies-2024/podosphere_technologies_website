import { getAccess } from '@/shared/server/access';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Team Management | Podo Social' };

export default async function TeamPage() {
  const { role, isPlatformAdmin } = await getAccess();

  // Members can't manage the team unless they are platform admins impersonating.
  if (role === 'MEMBER' && !isPlatformAdmin) {
    redirect('/dashboard/social');
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Team Management</h1>
          <p className="text-gray-500 mt-2">
            Invite team members and assign them to specific clients with tailored permissions.
          </p>
        </div>
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition font-medium text-sm">
            Manage Client Presets
          </button>
          <button className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium text-sm">
            Invite Member
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active Members</h2>
        </div>
        
        {/* Placeholder table for the UI foundation */}
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Role</th>
              <th className="px-6 py-4 font-medium">Client Access</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">John Doe</div>
                <div className="text-gray-500 text-xs">john@example.com</div>
              </td>
              <td className="px-6 py-4">
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                  ADMIN
                </span>
              </td>
              <td className="px-6 py-4">All Clients</td>
              <td className="px-6 py-4 text-right">
                <button className="text-gray-400 hover:text-black transition">Edit</button>
              </td>
            </tr>
            <tr>
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">Jane Smith</div>
                <div className="text-gray-500 text-xs">jane@example.com</div>
              </td>
              <td className="px-6 py-4">
                <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                  MEMBER
                </span>
              </td>
              <td className="px-6 py-4">3 Clients Assigned</td>
              <td className="px-6 py-4 text-right">
                <button className="text-gray-400 hover:text-black transition">Edit</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
