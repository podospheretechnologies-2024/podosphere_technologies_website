'use client';

import { MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface WaConnection {
  id: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string | null;
  businessName: string | null;
  customerId: string | null;
  connectedAt?: string;
}

interface SignupConfig {
  configured: boolean;
  appId: string | null;
  configId: string | null;
  graphVersion: string;
  connection: WaConnection | null;
  connections?: WaConnection[];
}

interface BroadcastRow {
  id: string;
  name: string;
  templateName: string;
  language?: string;
  status: string;
  sentCount: number;
  recipientCount: number;
  customerId?: string | null;
  createdAt?: string;
}

type AccountHealth =
  | { status: 'NOT_CONFIGURED' }
  | { status: 'ERROR'; details?: string }
  | {
      status: 'CONFIGURED';
      verificationStatus?: string;
      namespace?: string;
    };

type MessageStats =
  | { status: 'NOT_CONFIGURED' }
  | { status: 'ERROR'; details?: string }
  | {
      status: 'OK';
      days: number;
      sent: number;
      delivered: number;
    };

export function WhatsAppGrowthTools() {
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [config, setConfig] = useState<SignupConfig | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [pendingBroadcasts, setPendingBroadcasts] = useState<BroadcastRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [template, setTemplate] = useState({
    name: '',
    language: 'en',
    category: 'UTILITY',
    body: '',
  });
  const [broadcast, setBroadcast] = useState({
    name: '',
    templateName: '',
    language: 'en',
    phones: '',
    variables: '',
    consentAcknowledged: false,
  });
  const [estimate, setEstimate] = useState<{
    messageCount: number;
    optedOutCount: number;
    estimatedCostPaise: number;
    estimatedCostInr: number;
    ratePaise: number;
  } | null>(null);

  const [health, setHealth] = useState<AccountHealth | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  const connected = Boolean(config?.connection);

  function reload() {
    setLoading(true);
    void Promise.all([
      fetch('/api/social/whatsapp/embedded-signup')
        .then((response) => response.json())
        .then((data: SignupConfig) => setConfig(data)),
      fetch('/api/social/whatsapp/broadcasts')
        .then((response) => response.json())
        .then((data: BroadcastRow[]) => setBroadcasts(Array.isArray(data) ? data : [])),
      fetch('/api/social/whatsapp/broadcasts/pending')
        .then((response) => response.json())
        .then((data: BroadcastRow[]) =>
          setPendingBroadcasts(Array.isArray(data) ? data : [])
        )
        .catch(() => setPendingBroadcasts([])),
      fetch('/api/social/whatsapp/settings')
        .then((response) => response.json())
        .then((data: AccountHealth) => setHealth(data)),
    ]).finally(() => setLoading(false));
    // Not part of the gate above: a slow or failed stats call must not hold up the page.
    void fetch('/api/social/whatsapp/stats')
      .then((response) => response.json())
      .then((data: MessageStats) => setStats(data))
      .catch(() => setStats(null));
  }

  useEffect(() => {
    reload();
    setWebhookUrl(`${window.location.origin}/api/webhooks/whatsapp`);
    void fetch('/api/social/client-scope')
      .then((response) => response.json())
      .then((data: { clients?: { id: string; name: string }[] } | { id: string; name: string }[]) => {
        const list = Array.isArray(data) ? data : (data.clients ?? []);
        setClients(list.map((row) => ({ id: row.id, name: row.name })));
      })
      .catch(() => setClients([]));
  }, []);

  async function assignConnection(connectionId: string, customerId: string | null) {
    const response = await fetch('/api/social/whatsapp/embedded-signup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, customerId }),
    });
    const payload = (await response.json()) as { error?: string; connections?: WaConnection[] };
    if (!response.ok) {
      setMessage(payload.error || 'Could not assign number');
      return;
    }
    setConfig((prev) =>
      prev ? { ...prev, connections: payload.connections ?? prev.connections } : prev
    );
    setMessage('Number assigned.');
  }

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

  // Meta delivers the two halves of Embedded Signup separately: the WABA and
  // phone number IDs arrive as a window message from the popup, the code
  // arrives in the FB.login callback. Hold each until both are here.
  const signupCode = useRef<string | null>(null);
  const signupSession = useRef<{ wabaId: string; phoneNumberId: string } | null>(null);

  function submitSignupIfReady() {
    const code = signupCode.current;
    const session = signupSession.current;
    if (!code || !session) return;
    signupCode.current = null;
    signupSession.current = null;
    void fetch('/api/social/whatsapp/embedded-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, ...session }),
    })
      .then(async (result) => {
        const payload = (await result.json()) as { error?: string };
        if (!result.ok) throw new Error(payload.error || 'Connect failed');
        setMessage('WhatsApp number connected.');
        reload();
      })
      .catch((error: Error) => setMessage(error.message));
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      let host = '';
      try {
        host = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (host !== 'facebook.com' && !host.endsWith('.facebook.com')) return;
      let data: {
        type?: string;
        event?: string;
        data?: { waba_id?: string; phone_number_id?: string; error_message?: string };
      };
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
      const info = data.data;
      if (info?.waba_id && info.phone_number_id) {
        signupSession.current = { wabaId: info.waba_id, phoneNumberId: info.phone_number_id };
        submitSignupIfReady();
      } else if (data.event === 'CANCEL') {
        setMessage(
          info?.error_message
            ? `Meta signup failed: ${info.error_message}`
            : 'Meta signup was closed before it finished. Try again and complete every step.'
        );
      } else if (info?.waba_id) {
        setMessage('Meta signup finished without a phone number. Run it again and add a number.');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    signupCode.current = null;
    signupSession.current = null;
    if (!config?.appId || !config.configId) {
      setMessage('Set META_APP_ID and WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID first.');
      return;
    }
    const sdk = (
      window as unknown as {
        FB?: {
          login: (
            cb: (response: { authResponse?: { code?: string } }) => void,
            options: object
          ) => void;
        };
      }
    ).FB;
    if (!sdk) {
      setMessage(
        'Facebook SDK is not loaded on this page yet. Finish Embedded Signup config in Meta, then reload.'
      );
      return;
    }
    sdk.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setMessage('Meta did not return a sign-in code. Finish the Meta popup and try again.');
          return;
        }
        signupCode.current = code;
        submitSignupIfReady();
        // The popup's message normally lands first; give it a moment if not.
        window.setTimeout(() => {
          if (signupCode.current === code) {
            setMessage(
              'Meta returned a code but no WhatsApp account or number. Finish every step of the popup and try again.'
            );
          }
        }, 5000);
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
    setMessage(
      response.ok
        ? `Template submitted (${payload.status ?? 'PENDING'}). Meta must approve it.`
        : payload.error || 'Template failed'
    );
  }

  async function estimateBroadcast() {
    setMessage(null);
    setEstimate(null);
    const phones = broadcast.phones.split(/[\s,]+/).filter(Boolean);
    const response = await fetch('/api/social/whatsapp/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'estimate', phones }),
    });
    const payload = (await response.json()) as {
      error?: string;
      messageCount?: number;
      optedOutCount?: number;
      estimatedCostPaise?: number;
      estimatedCostInr?: number;
      ratePaise?: number;
    };
    if (!response.ok || payload.messageCount === undefined) {
      setMessage(payload.error || 'Could not estimate cost');
      return;
    }
    setEstimate({
      messageCount: payload.messageCount,
      optedOutCount: payload.optedOutCount ?? 0,
      estimatedCostPaise: payload.estimatedCostPaise ?? 0,
      estimatedCostInr: payload.estimatedCostInr ?? 0,
      ratePaise: payload.ratePaise ?? 0,
    });
  }

  async function approvePending(id: string) {
    const confirmed = window.confirm('Approve and send this client broadcast now?');
    if (!confirmed) return;
    setMessage(null);
    const response = await fetch(`/api/social/whatsapp/broadcasts/${id}/approve`, {
      method: 'POST',
    });
    const payload = (await response.json()) as {
      error?: string;
      sent?: number;
      total?: number;
    };
    setMessage(
      response.ok
        ? `Approved and sent ${payload.sent ?? 0}/${payload.total ?? 0}.`
        : payload.error || 'Could not approve broadcast'
    );
    reload();
  }

  async function rejectPending(id: string) {
    const confirmed = window.confirm('Reject this client broadcast? Nothing will be sent.');
    if (!confirmed) return;
    setMessage(null);
    const response = await fetch(`/api/social/whatsapp/broadcasts/${id}/reject`, {
      method: 'POST',
    });
    const payload = (await response.json()) as { error?: string };
    setMessage(response.ok ? 'Broadcast rejected.' : payload.error || 'Could not reject');
    reload();
  }

  async function sendBroadcast() {
    if (!broadcast.consentAcknowledged) {
      setMessage('Acknowledge recipient consent before sending.');
      return;
    }
    if (!estimate) {
      setMessage('Estimate cost first, then confirm send.');
      return;
    }
    const confirmed = window.confirm(
      `Send ${estimate.messageCount} messages (~₹${estimate.estimatedCostInr.toFixed(2)})? ${estimate.optedOutCount} opted-out will be skipped.`
    );
    if (!confirmed) return;

    const response = await fetch('/api/social/whatsapp/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: broadcast.name,
        templateName: broadcast.templateName,
        language: broadcast.language,
        phones: broadcast.phones.split(/[\s,]+/).filter(Boolean),
        variables: broadcast.variables
          .split('|')
          .map((part) => part.trim())
          .filter(Boolean),
        consentAcknowledged: true,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      sent?: number;
      total?: number;
      skippedOptedOut?: number;
      estimatedCostPaise?: number;
    };
    setMessage(
      response.ok
        ? `Sent ${payload.sent}/${payload.total} (skipped ${payload.skippedOptedOut ?? 0} opted-out · est. ₹${((payload.estimatedCostPaise ?? 0) / 100).toFixed(2)})`
        : payload.error || 'Broadcast failed'
    );
    setEstimate(null);
    reload();
  }

  async function configureWebhook() {
    const response = await fetch('/api/social/whatsapp/settings', { method: 'POST' });
    const payload = (await response.json()) as {
      error?: string;
      callbackUrl?: string;
    };
    if (response.ok && payload.callbackUrl) setWebhookUrl(payload.callbackUrl);
    setMessage(
      response.ok
        ? `WhatsApp webhook set to ${payload.callbackUrl ?? webhookUrl}`
        : payload.error || 'Failed to configure webhook'
    );
  }

  if (loading && !config) {
    return (
      <div className="border-border bg-surface text-muted-foreground rounded-2xl border p-8 text-sm">
        Checking WhatsApp connection…
      </div>
    );
  }

  // Connect-first: templates / broadcasts stay locked until Embedded Signup finishes.
  if (!connected) {
    return (
      <section className="border-border bg-surface space-y-4 rounded-2xl border p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="bg-wa-accent/15 text-wa-accent flex size-11 shrink-0 items-center justify-center rounded-2xl">
              <MessageCircle className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Connect WhatsApp first</h2>
              <p className="text-muted-foreground mt-1 max-w-xl text-xs">
                Link a WhatsApp Business number with Embedded Signup. Templates, broadcasts, inbox
                and auto-replies unlock after the connection is saved.
              </p>
            </div>
          </div>
          <Button type="button" onClick={() => void connect()} disabled={!config?.configured}>
            Connect WhatsApp
          </Button>
        </div>
        {!config?.configured && (
          <p className="text-muted-foreground rounded-xl border border-dashed px-3 py-2 text-xs">
            Embedded Signup is not ready on the server yet. Set{' '}
            <code className="text-foreground">META_APP_ID</code>,{' '}
            <code className="text-foreground">META_APP_SECRET</code> and{' '}
            <code className="text-foreground">WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID</code>, then reload.
          </p>
        )}
        {message && (
          <p className="text-muted-foreground bg-surface-muted rounded-lg p-2 text-xs font-medium">
            {message}
          </p>
        )}
      </section>
    );
  }

  const connection = config!.connection!;

  return (
    <div className="space-y-6">
      <section className="border-border bg-surface space-y-4 rounded-2xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">WhatsApp connected</h2>
            <p className="text-muted-foreground text-xs">
              WABA {connection.wabaId}
              {connection.displayPhone ? ` · ${connection.displayPhone}` : ''}
              {connection.businessName ? ` · ${connection.businessName}` : ''}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void connect()}>
            Reconnect / add number
          </Button>
        </div>

        {(config?.connections?.length ?? 0) > 0 && (
          <ul className="border-border divide-y rounded-xl border text-xs">
            {(config?.connections ?? []).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
              >
                <span>
                  {row.displayPhone || row.phoneNumberId}
                  {row.businessName ? ` · ${row.businessName}` : ''}
                </span>
                <select
                  className="border-border h-8 rounded-lg border bg-transparent px-2"
                  value={row.customerId ?? ''}
                  onChange={(event) =>
                    void assignConnection(row.id, event.target.value || null)
                  }
                >
                  <option value="">Agency (shared)</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}

        {health?.status === 'CONFIGURED' && (
          <div className="bg-surface-muted/30 border-border flex flex-wrap gap-4 rounded-xl border p-3 text-xs">
            <div>
              <span className="mb-1 block font-semibold">Business Verification:</span>
              <span
                className={
                  health.verificationStatus === 'VERIFIED'
                    ? 'text-success font-medium'
                    : 'font-medium text-amber-500'
                }
              >
                {health.verificationStatus}
              </span>
            </div>
            <div>
              <span className="mb-1 block font-semibold">Template Namespace:</span>
              <span className="text-muted-foreground">{health.namespace || 'N/A'}</span>
            </div>
          </div>
        )}

        {stats?.status === 'OK' && (
          <div className="bg-surface-muted/30 border-border rounded-xl border p-3 text-xs">
            <p className="mb-2 font-semibold">Messages in the last {stats.days} days</p>
            <div className="flex flex-wrap gap-6">
              <div>
                <span className="block text-lg font-semibold">{stats.sent}</span>
                <span className="text-muted-foreground">Sent</span>
              </div>
              <div>
                <span className="block text-lg font-semibold">{stats.delivered}</span>
                <span className="text-muted-foreground">Delivered</span>
              </div>
              <div>
                <span className="block text-lg font-semibold">
                  {stats.sent > 0 ? `${Math.round((stats.delivered / stats.sent) * 100)}%` : '—'}
                </span>
                <span className="text-muted-foreground">Delivery rate</span>
              </div>
            </div>
            <p className="text-muted-foreground mt-2">
              Counted by Meta for this number, including messages sent from other tools.
            </p>
          </div>
        )}
        {stats?.status === 'ERROR' && (
          <p className="text-muted-foreground text-xs">
            Message stats unavailable: {stats.details ?? 'Meta did not return them.'}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold">Submit a template</p>
            <input
              className="border-border h-10 w-full rounded-xl border px-3 text-sm"
              placeholder="template_name"
              value={template.name}
              onChange={(event) => setTemplate({ ...template, name: event.target.value })}
            />
            <textarea
              className="border-border w-full rounded-xl border px-3 py-2 text-sm"
              rows={3}
              placeholder="Body text. Use {{1}} for variables."
              value={template.body}
              onChange={(event) => setTemplate({ ...template, body: event.target.value })}
            />
            <Button type="button" variant="secondary" onClick={() => void createTemplate()}>
              Submit to Meta
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold">Broadcast an approved template</p>
            <input
              className="border-border h-10 w-full rounded-xl border px-3 text-sm"
              placeholder="Campaign name"
              value={broadcast.name}
              onChange={(event) => setBroadcast({ ...broadcast, name: event.target.value })}
            />
            <input
              className="border-border h-10 w-full rounded-xl border px-3 text-sm"
              placeholder="Approved template name"
              value={broadcast.templateName}
              onChange={(event) =>
                setBroadcast({ ...broadcast, templateName: event.target.value })
              }
            />
            <textarea
              className="border-border w-full rounded-xl border px-3 py-2 text-sm"
              rows={3}
              placeholder="Phones, one per line"
              value={broadcast.phones}
              onChange={(event) => {
                setBroadcast({ ...broadcast, phones: event.target.value });
                setEstimate(null);
              }}
            />
            <label className="text-muted-foreground flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={broadcast.consentAcknowledged}
                onChange={(event) =>
                  setBroadcast({ ...broadcast, consentAcknowledged: event.target.checked })
                }
              />
              I confirm these recipients opted in to WhatsApp messages and can opt out via STOP.
            </label>
            {estimate && (
              <p className="text-muted-foreground text-xs">
                Estimate: {estimate.messageCount} messages × ₹{(estimate.ratePaise / 100).toFixed(2)}{' '}
                ≈ ₹{estimate.estimatedCostInr.toFixed(2)}
                {estimate.optedOutCount > 0
                  ? ` · ${estimate.optedOutCount} opted-out skipped`
                  : ''}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => void estimateBroadcast()}>
                Estimate cost
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void sendBroadcast()}
                disabled={!broadcast.consentAcknowledged || !estimate}
              >
                Confirm and send
              </Button>
            </div>
          </div>
        </div>

        <div className="border-border mt-4 border-t pt-4">
          <p className="mb-2 text-xs font-semibold">WhatsApp webhook</p>
          <div className="flex gap-2">
            <input
              className="border-border bg-surface-muted h-10 w-full rounded-xl border px-3 text-sm"
              readOnly
              value={webhookUrl}
            />
            <Button type="button" variant="secondary" onClick={() => void configureWebhook()}>
              1-Click Connect
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Always uses APP_URL/api/webhooks/whatsapp. Merges WABA fields only; does not change
            Meta/Instagram page webhooks.
          </p>
        </div>

        {message && (
          <p className="text-muted-foreground bg-surface-muted rounded-lg p-2 text-xs font-medium">
            {message}
          </p>
        )}

        {pendingBroadcasts.length > 0 && (
          <div className="border-border border-t pt-4">
            <p className="mb-2 text-xs font-semibold">Client broadcasts awaiting approval</p>
            <ul className="space-y-2">
              {pendingBroadcasts.map((row) => (
                <li
                  key={row.id}
                  className="border-border flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {row.name} · {row.templateName}
                    </p>
                    <p className="text-muted-foreground">
                      {row.recipientCount} recipients
                      {row.createdAt
                        ? ` · ${new Date(row.createdAt).toLocaleString()}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void approvePending(row.id)}
                    >
                      Approve & send
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void rejectPending(row.id)}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {broadcasts.length > 0 && (
          <ul className="text-muted-foreground space-y-1 text-xs">
            {broadcasts.map((row) => (
              <li key={row.id}>
                {row.name} · {row.templateName} · {row.status} · {row.sentCount}/
                {row.recipientCount}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
