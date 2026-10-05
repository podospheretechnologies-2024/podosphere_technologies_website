'use client';

import { Link2, Unlink } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { usePodoCrmWhatsAppSync } from '../../hooks/use-podocrm-whatsapp-sync';
import {
  linkPodoCrmWhatsApp,
  unlinkPodoCrmWhatsApp,
} from '../../lib/podocrm-whatsapp-sync.client';

function formatWhen(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function PodoCrmWhatsAppLinkCard() {
  const { data, error, isLoading, mutate } = usePodoCrmWhatsAppSync();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'link' | 'unlink' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function connect() {
    setActionError(null);
    setNotice(null);
    setBusy('link');
    try {
      const result = await linkPodoCrmWhatsApp(code);
      setCode('');
      setNotice(
        result.linked
          ? `Linked to PodoCRM${result.phoneNumberId ? ` · phone ${result.phoneNumberId}` : ''}.`
          : 'Link request completed.'
      );
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not link PodoCRM');
    } finally {
      setBusy(null);
    }
  }

  async function unlink() {
    if (!window.confirm('Unlink PodoCRM WhatsApp sync for this workspace?')) {
      return;
    }
    setActionError(null);
    setNotice(null);
    setBusy('unlink');
    try {
      await unlinkPodoCrmWhatsApp();
      setNotice('PodoCRM WhatsApp sync unlinked.');
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not unlink');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-border space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Link2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Link PodoCRM</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Paste a one-time sync code from PodoCRM → Connectors → WhatsApp → PodoSocial sync
            (e.g. <code className="text-xs">PSL-9R76E-PPAD2</code>). This is not on the chat page.
            Codes expire in about 15 minutes. Only new traffic syncs after linking — history does
            not.
          </p>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading link status…</p>}
      {error && (
        <p className="text-danger text-sm">
          {error instanceof Error ? error.message : 'Could not load link status'}
        </p>
      )}

      {data?.linked ? (
        <div className="bg-success/5 border-success/20 space-y-2 rounded-xl border px-4 py-3 text-sm">
          <p className="text-success font-semibold">Linked</p>
          <dl className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-medium text-[11px] tracking-wide uppercase">Phone number id</dt>
              <dd className="text-foreground mt-0.5 font-mono break-all">{data.phoneNumberId}</dd>
            </div>
            <div>
              <dt className="font-medium text-[11px] tracking-wide uppercase">PodoCRM company</dt>
              <dd className="text-foreground mt-0.5 font-mono break-all">{data.podocrmCompanyId}</dd>
            </div>
            <div>
              <dt className="font-medium text-[11px] tracking-wide uppercase">Linked at</dt>
              <dd className="text-foreground mt-0.5">{formatWhen(data.linkedAt) ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-[11px] tracking-wide uppercase">Last ping</dt>
              <dd className="text-foreground mt-0.5">{formatWhen(data.lastPingAt) ?? 'Not yet'}</dd>
            </div>
          </dl>
          <div className="pt-1">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy !== null}
              onClick={() => void unlink()}
            >
              <Unlink className="size-3.5" />
              {busy === 'unlink' ? 'Unlinking…' : 'Unlink'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Not linked
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="PSL-…"
              className="font-mono sm:max-w-xs"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              size="sm"
              disabled={busy !== null || code.trim().length < 8}
              onClick={() => void connect()}
            >
              {busy === 'link' ? 'Connecting…' : 'Connect'}
            </Button>
          </div>
        </div>
      )}

      {notice && <p className="text-success text-sm">{notice}</p>}
      {actionError && <p className="text-danger text-sm">{actionError}</p>}
    </Card>
  );
}
