'use client';

import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { Check, Copy, Link as LinkIcon, Loader2, Trash2 } from 'lucide-react';
import { apiFetch, ApiError, fetcher } from '@/shared/lib/fetcher';

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  createdAt: string;
  lastLoginAt: string | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

interface TeamData {
  members: Member[];
  invitations: PendingInvite[];
  currentUserId: string;
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-purple-50 text-purple-700',
  ADMIN: 'bg-blue-50 text-blue-700',
  MEMBER: 'bg-gray-100 text-gray-700',
};

function roleBadge(role: string) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_BADGE[role] ?? ROLE_BADGE.MEMBER}`}>
      {role}
    </span>
  );
}

export function TeamClient({ initialData }: { initialData: TeamData }) {
  const { data, mutate } = useSWR<TeamData>('/api/team/members', fetcher, {
    fallbackData: initialData,
  });
  const members = data?.members ?? [];
  const invitations = data?.invitations ?? [];

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setInviteUrl(null);
    try {
      const res = await apiFetch<{ inviteUrl: string }>('/api/team/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      setInviteUrl(res.inviteUrl);
      setEmail('');
      await mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the invite.');
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is still visible to copy manually */
    }
  }

  async function revoke(id: string) {
    await apiFetch(`/api/team/invitations/${id}`, { method: 'DELETE' });
    await mutate();
  }

  return (
    <div className="space-y-8">
      {/* Invite form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite a member</h2>
        <form onSubmit={createInvite} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@agency.com"
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-gray-900"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="mb-1.5 block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-gray-900"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-black px-4 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
            Generate invite link
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {inviteUrl && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="mb-2 text-sm font-medium text-green-800">
              Invite link ready — copy it now and send it to them. It works once and expires in 72 hours.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteUrl}
                className="h-9 flex-1 rounded-md border border-green-300 bg-white px-3 font-mono text-xs text-gray-700"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-green-700 px-3 text-sm font-medium text-white hover:bg-green-800"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active members */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active members ({members.length})</h2>
        </div>
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Role</th>
              <th className="px-6 py-4 font-medium">Last login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">
                    {m.name}
                    {m.id === data?.currentUserId && (
                      <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>
                    )}
                  </div>
                  <div className="text-gray-500 text-xs">{m.email}</div>
                </td>
                <td className="px-6 py-4">{roleBadge(m.role)}</td>
                <td className="px-6 py-4 text-gray-500">
                  {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invites */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Pending invites ({invitations.length})
            </h2>
          </div>
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Expires</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invitations.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-6 py-4 text-gray-900">{inv.email}</td>
                  <td className="px-6 py-4">{roleBadge(inv.role)}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void revoke(inv.id)}
                      className="inline-flex items-center gap-1.5 text-gray-400 transition hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" /> Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
