'use client';

import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';

interface SignupConfig {
  configured: boolean;
  appId: string | null;
  configId: string | null;
  graphVersion: string;
  connection: {
    wabaId: string;
    phoneNumberId: string;
    displayPhone: string | null;
    businessName: string | null;
  } | null;
}

interface BroadcastRow {
  id: string;
  name: string;
  templateName: string;
  status: string;
  sentCount: number;
  recipientCount: number;
}

type AccountHealth =
  | { status: 'NOT_CONFIGURED' }
  | { status: 'ERROR'; details?: string }
  | {
      status: 'CONFIGURED';
      verificationStatus?: string;
      namespace?: string;
    };

export function WhatsAppGrowthTools() {
  const [config, setConfig] = useState<SignupConfig | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
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
      fetch('/api/social/whatsapp/settings')
        .then((response) => response.json())
        .then((data: AccountHealth) => setHealth(data)),
    ]).finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    setWebhookUrl(`${window.location.origin}/api/webhooks/whatsapp`);
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
        const session = (
          response as {
            authResponse?: { code?: string };
            sessionInfo?: { waba_id?: string; phone_number_id?: string };
          }
        ).sessionInfo;
        if (!code || !session?.waba_id || !session.phone_number_id) {
          setMessage('Embedded Signup did not return a code and WABA. Finish the Meta popup and try again.');
          return;
        }
        void fetch('/api/social/whatsapp/embedded-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            wabaId: session.waba_id,
            phoneNumberId: session.phone_number_id,
          }),
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
    const response = await fetch('/api/social/whatsapp/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl }),
    });
    const payload = await response.json();
    setMessage(
      response.ok
        ? 'Webhook successfully configured!'
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
            Reconnect
          </Button>
        </div>

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
          <p className="mb-2 text-xs font-semibold">Automated Webhook Configuration</p>
          <div className="flex gap-2">
            <input
              className="border-border h-10 w-full rounded-xl border px-3 text-sm"
              placeholder="https://domain.com/api/webhooks/whatsapp"
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
            />
            <Button type="button" variant="secondary" onClick={() => void configureWebhook()}>
              1-Click Connect
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Automatically subscribe to WhatsApp message events directly to this URL.
          </p>
        </div>

        {message && (
          <p className="text-muted-foreground bg-surface-muted rounded-lg p-2 text-xs font-medium">
            {message}
          </p>
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
