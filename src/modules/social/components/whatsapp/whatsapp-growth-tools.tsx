'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface SignupConfig {
  configured: boolean;
  appId: string | null;
  configId: string | null;
  graphVersion: string;
  connection: { wabaId: string; phoneNumberId: string; displayPhone: string | null; businessName: string | null } | null;
}

interface BroadcastRow {
  id: string;
  name: string;
  templateName: string;
  status: string;
  sentCount: number;
  recipientCount: number;
}

export function WhatsAppGrowthTools() {
  const [config, setConfig] = useState<SignupConfig | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [template, setTemplate] = useState({ name: '', language: 'en', category: 'UTILITY', body: '' });
  const [broadcast, setBroadcast] = useState({ name: '', templateName: '', language: 'en', phones: '', variables: '' });

  function reload() {
    void fetch('/api/social/whatsapp/embedded-signup')
      .then((response) => response.json())
      .then((data: SignupConfig) => setConfig(data));
    void fetch('/api/social/whatsapp/broadcasts')
      .then((response) => response.json())
      .then((data: BroadcastRow[]) => setBroadcasts(Array.isArray(data) ? data : []));
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!config?.appId || document.getElementById('facebook-jssdk')) return;
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.onload = () => {
      (window as unknown as { FB?: { init: (options: object) => void } }).FB?.init({
        appId: config.appId,
        cookie: true,
        xfbml: false,
        version: config.graphVersion || 'v26.0',
      });
    };
    document.body.appendChild(script);
  }, [config?.appId, config?.graphVersion]);

  async function connect() {
    if (!config?.appId || !config.configId) {
      setMessage('Set META_APP_ID and WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID first.');
      return;
    }
    const sdk = (window as unknown as { FB?: { login: (cb: (response: { authResponse?: { code?: string } }) => void, options: object) => void } }).FB;
    if (!sdk) {
      setMessage('Facebook SDK is not loaded on this page yet. Finish Embedded Signup config in Meta, then reload.');
      return;
    }
    sdk.login(
      (response) => {
        const code = response.authResponse?.code;
        const session = (response as { authResponse?: { code?: string }; sessionInfo?: { waba_id?: string; phone_number_id?: string } }).sessionInfo;
        if (!code || !session?.waba_id || !session.phone_number_id) {
          setMessage('Embedded Signup did not return a code and WABA. Finish the Meta popup and try again.');
          return;
        }
        void fetch('/api/social/whatsapp/embedded-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, wabaId: session.waba_id, phoneNumberId: session.phone_number_id }),
        })
          .then(async (result) => {
            const payload = (await result.json()) as { error?: string };
            if (!result.ok) throw new Error(payload.error || 'Connect failed');
            setMessage('WhatsApp number connected.');
            reload();
          })
          .catch((error: Error) => setMessage(error.message));
      },
      {
        config_id: config.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
      }
    );
  }

  async function createTemplate() {
    const response = await fetch('/api/social/whatsapp/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    const payload = (await response.json()) as { error?: string; status?: string };
    setMessage(response.ok ? `Template submitted (${payload.status ?? 'PENDING'}). Meta must approve it.` : payload.error || 'Template failed');
  }

  async function sendBroadcast() {
    const response = await fetch('/api/social/whatsapp/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: broadcast.name,
        templateName: broadcast.templateName,
        language: broadcast.language,
        phones: broadcast.phones.split(/[\s,]+/).filter(Boolean),
        variables: broadcast.variables.split('|').map((part) => part.trim()).filter(Boolean),
      }),
    });
    const payload = (await response.json()) as { error?: string; sent?: number; total?: number };
    setMessage(response.ok ? `Sent ${payload.sent}/${payload.total}` : payload.error || 'Broadcast failed');
    reload();
  }

  return (
    <section className="border-border bg-surface space-y-4 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Embedded Signup, templates and broadcasts</h2>
          <p className="text-muted-foreground text-xs">
            {config?.connection
              ? `Connected WABA ${config.connection.wabaId}${config.connection.displayPhone ? ` · ${config.connection.displayPhone}` : ''}`
              : 'Connect a client WhatsApp number, submit a template, then broadcast to an opted-in list.'}
          </p>
        </div>
        <Button type="button" onClick={() => void connect()} disabled={!config?.configured}>
          Connect WhatsApp
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold">Submit a template</p>
          <input className="border-border h-10 w-full rounded-xl border px-3 text-sm" placeholder="template_name" value={template.name} onChange={(event) => setTemplate({ ...template, name: event.target.value })} />
          <textarea className="border-border w-full rounded-xl border px-3 py-2 text-sm" rows={3} placeholder="Body text. Use {{1}} for variables." value={template.body} onChange={(event) => setTemplate({ ...template, body: event.target.value })} />
          <Button type="button" variant="secondary" onClick={() => void createTemplate()}>Submit to Meta</Button>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold">Broadcast an approved template</p>
          <input className="border-border h-10 w-full rounded-xl border px-3 text-sm" placeholder="Campaign name" value={broadcast.name} onChange={(event) => setBroadcast({ ...broadcast, name: event.target.value })} />
          <input className="border-border h-10 w-full rounded-xl border px-3 text-sm" placeholder="Approved template name" value={broadcast.templateName} onChange={(event) => setBroadcast({ ...broadcast, templateName: event.target.value })} />
          <textarea className="border-border w-full rounded-xl border px-3 py-2 text-sm" rows={3} placeholder="Phones, one per line" value={broadcast.phones} onChange={(event) => setBroadcast({ ...broadcast, phones: event.target.value })} />
          <Button type="button" variant="secondary" onClick={() => void sendBroadcast()}>Send broadcast</Button>
        </div>
      </div>
      {message && <p className="text-muted-foreground text-xs">{message}</p>}
      {broadcasts.length > 0 && (
        <ul className="text-muted-foreground space-y-1 text-xs">
          {broadcasts.map((row) => (
            <li key={row.id}>{row.name} · {row.templateName} · {row.status} · {row.sentCount}/{row.recipientCount}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
