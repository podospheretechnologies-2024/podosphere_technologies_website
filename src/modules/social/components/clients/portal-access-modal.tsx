'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Link2, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Modal } from '@/shared/components/ui/modal';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';
import { PortalGoalsSettings } from './portal-goals-settings';
import { PortalRequestsAgency } from './portal-requests-agency';
import { PortalTabsSettings } from './portal-tabs-settings';

type ApproverRow = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  hasPassword: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  disabledAt: string | null;
};

type Props = {
  open: boolean;
  clientId: string;
  clientName: string;
  onClose: () => void;
};

export function PortalAccessModal({ open, clientId, clientName, onClose }: Props) {
  const [approvers, setApprovers] = useState<ApproverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<{
    approverId: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [magicCopiedId, setMagicCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ approvers: ApproverRow[] }>(
        `/api/social/clients/${clientId}/approvers`
      );
      setApprovers(res.approvers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load portal access.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (!open) return;
    setGeneratedPassword(null);
    setLinkNotice(null);
    setName('');
    setEmail('');
    setPhone('');
    void load();
  }, [open, load]);

  async function addLogin() {
    setAdding(true);
    setError(null);
    try {
      await apiFetch(`/api/social/clients/${clientId}/approvers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
        }),
      });
      setName('');
      setEmail('');
      setPhone('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add login.');
    } finally {
      setAdding(false);
    }
  }

  async function savePhone(approverId: string, nextPhone: string) {
    setBusyId(approverId);
    setError(null);
    try {
      const res = await apiFetch<{ approver: ApproverRow }>(
        `/api/social/clients/${clientId}/approvers/${approverId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: nextPhone.trim() || null }),
        }
      );
      setApprovers((rows) => rows.map((row) => (row.id === approverId ? res.approver : row)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save phone.');
    } finally {
      setBusyId(null);
    }
  }

  async function generatePassword(approverId: string) {
    setBusyId(approverId);
    setError(null);
    setLinkNotice(null);
    try {
      const res = await apiFetch<{ password: string; approver: ApproverRow }>(
        `/api/social/clients/${clientId}/approvers/${approverId}/password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate' }),
        }
      );
      setGeneratedPassword({ approverId, password: res.password });
      setApprovers((rows) => rows.map((row) => (row.id === approverId ? res.approver : row)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate password.');
    } finally {
      setBusyId(null);
    }
  }

  async function sendSetPasswordLink(approverId: string) {
    setBusyId(approverId);
    setError(null);
    setGeneratedPassword(null);
    try {
      const res = await apiFetch<{ sent: boolean; link?: string }>(
        `/api/social/clients/${clientId}/approvers/${approverId}/password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send_link' }),
        }
      );
      if (res.sent) {
        setLinkNotice('Set-password email sent.');
      } else if (res.link) {
        await navigator.clipboard.writeText(res.link);
        setLinkNotice('Email not configured — set-password link copied to clipboard.');
      } else {
        setLinkNotice('Could not send email. Try again or generate a password instead.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send set-password link.');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDisabled(approver: ApproverRow) {
    setBusyId(approver.id);
    setError(null);
    try {
      const res = await apiFetch<{ approver: ApproverRow }>(
        `/api/social/clients/${clientId}/approvers/${approver.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ disabled: !approver.disabledAt }),
        }
      );
      setApprovers((rows) => rows.map((row) => (row.id === approver.id ? res.approver : row)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update login.');
    } finally {
      setBusyId(null);
    }
  }

  async function openPortal(approverId: string) {
    setOpeningId(approverId);
    setError(null);
    try {
      const res = await apiFetch<{ redirectTo: string }>(
        `/api/social/clients/${clientId}/portal-login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approverId }),
        }
      );
      window.open(res.redirectTo, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open portal.');
    } finally {
      setOpeningId(null);
    }
  }

  async function copyMagicLink(approverId: string) {
    setBusyId(approverId);
    setError(null);
    try {
      const res = await apiFetch<{ magicLink: string }>(
        `/api/social/clients/${clientId}/magic-link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approverId }),
        }
      );
      await navigator.clipboard.writeText(res.magicLink);
      setMagicCopiedId(approverId);
      setTimeout(() => setMagicCopiedId(null), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create magic link.');
    } finally {
      setBusyId(null);
    }
  }

  async function copyGenerated() {
    if (!generatedPassword) return;
    await navigator.clipboard.writeText(generatedPassword.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Portal access"
      description={`Logins for ${clientName}. Clients sign in on the Client login tab at /login.`}
      size="lg"
    >
      <div className="space-y-5">
        {error ? <p className="text-danger text-sm">{error}</p> : null}
        {linkNotice ? <p className="text-sm text-green-700">{linkNotice}</p> : null}

        {generatedPassword ? (
          <div className="border-border bg-surface-muted rounded-lg border p-3">
            <p className="text-sm font-medium">Temporary password (shown once)</p>
            <p className="mt-1 font-mono text-sm break-all">{generatedPassword.password}</p>
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={copyGenerated}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy password'}
            </Button>
            <p className="text-muted-foreground mt-2 text-xs">
              Send this to the client securely. They must set their own password on first login.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium">Existing logins</p>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : approvers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No portal logins yet.</p>
          ) : (
            <ul className="divide-border border-border divide-y rounded-lg border">
              {approvers.map((approver) => (
                <li key={approver.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {approver.name || 'Unnamed'}{' '}
                      {approver.disabledAt ? (
                        <span className="text-danger text-xs font-normal">(disabled)</span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">{approver.email}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {approver.hasPassword
                        ? approver.mustChangePassword
                          ? 'Temp password — must change on login'
                          : 'Password set'
                        : 'No password yet (magic link still works)'}
                      {approver.lastLoginAt
                        ? ` · Last login ${new Date(approver.lastLoginAt).toLocaleDateString()}`
                        : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        defaultValue={approver.phone ?? ''}
                        placeholder="WhatsApp phone (optional)"
                        className="h-8 max-w-[200px] text-xs"
                        id={`phone-${approver.id}`}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busyId === approver.id || Boolean(approver.disabledAt)}
                        onClick={() => {
                          const input = document.getElementById(
                            `phone-${approver.id}`
                          ) as HTMLInputElement | null;
                          void savePhone(approver.id, input?.value ?? '');
                        }}
                      >
                        Save phone
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={openingId === approver.id || Boolean(approver.disabledAt)}
                      onClick={() => openPortal(approver.id)}
                      title="Open the client portal as this login (see their data)"
                    >
                      <LogIn className="size-3.5" />
                      {openingId === approver.id ? 'Opening…' : 'Open portal'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyId === approver.id || Boolean(approver.disabledAt)}
                      onClick={() => copyMagicLink(approver.id)}
                    >
                      {magicCopiedId === approver.id ? (
                        <Check className="size-3.5 text-green-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {magicCopiedId === approver.id ? 'Link copied' : 'Copy magic link'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyId === approver.id || Boolean(approver.disabledAt)}
                      onClick={() => generatePassword(approver.id)}
                    >
                      <KeyRound className="size-3.5" />
                      Generate password
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyId === approver.id || Boolean(approver.disabledAt)}
                      onClick={() => sendSetPasswordLink(approver.id)}
                    >
                      <Link2 className="size-3.5" />
                      Send set-password link
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={approver.disabledAt ? 'secondary' : 'danger-ghost'}
                      disabled={busyId === approver.id}
                      onClick={() => toggleDisabled(approver)}
                    >
                      {approver.disabledAt ? 'Enable' : 'Disable'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-border space-y-3 border-t pt-4">
          <p className="text-sm font-medium">Add a login</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="portal-name" className="mb-1 block text-xs font-medium">
                Name
              </label>
              <Input
                id="portal-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Marketing manager"
              />
            </div>
            <div>
              <label htmlFor="portal-email" className="mb-1 block text-xs font-medium">
                Email
              </label>
              <Input
                id="portal-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="client@brand.com"
              />
            </div>
            <div>
              <label htmlFor="portal-phone" className="mb-1 block text-xs font-medium">
                WhatsApp phone
              </label>
              <Input
                id="portal-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="9198…"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={adding || !name.trim() || !email.trim()}
            onClick={addLogin}
          >
            <UserPlus className="size-3.5" />
            {adding ? 'Adding…' : 'Add login'}
          </Button>
        </div>

        <PortalTabsSettings clientId={clientId} active={open} />
        <PortalGoalsSettings clientId={clientId} active={open} />
        <PortalRequestsAgency clientId={clientId} active={open} />
      </div>
    </Modal>
  );
}
