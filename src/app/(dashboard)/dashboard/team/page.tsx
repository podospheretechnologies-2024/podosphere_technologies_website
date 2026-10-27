import { redirect } from 'next/navigation';
import { getAccess } from '@/shared/server/access';
import { invitationService } from '@/modules/auth/server/invitation.service';
import { TeamClient } from '@/modules/auth/components/team-client';

export const metadata = { title: 'Team Management | Podo Social' };

export default async function TeamPage() {
  const ctx = await getAccess();

  // Members can't manage the team unless they are platform admins impersonating.
  if (ctx.role === 'MEMBER' && !ctx.isPlatformAdmin) {
    redirect('/dashboard/social');
  }

  const [members, invitations] = await Promise.all([
    invitationService.listMembers(ctx.organization.id),
    invitationService.listPendingInvitations(ctx.organization.id),
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Team Management</h1>
        <p className="text-gray-500 mt-2">
          Invite team members with an invite link. They set their own password — no shared passwords.
        </p>
      </div>

      <TeamClient
        initialData={{
          members: members.map((m) => ({
            ...m,
            createdAt: m.createdAt.toISOString(),
            lastLoginAt: m.lastLoginAt ? m.lastLoginAt.toISOString() : null,
          })),
          invitations: invitations.map((i) => ({
            ...i,
            createdAt: i.createdAt.toISOString(),
            expiresAt: i.expiresAt.toISOString(),
          })),
          currentUserId: ctx.user.id,
        }}
      />
    </div>
  );
}
