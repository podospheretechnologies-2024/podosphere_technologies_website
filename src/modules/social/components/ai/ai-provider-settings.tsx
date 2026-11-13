'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useSWRConfig } from 'swr';
import { Button } from '@/shared/components/ui/button';
import { AI_PROVIDER_OPTIONS, type AiProvider } from '../../config/ai';
import { AI_API_ROUTE } from '../../hooks/use-ai-status';
import { useClientScopeKey } from '../../hooks/use-client-scope';
import type { AiProviderDisplay } from '../../types/ai';

const PROVIDER_ROUTE = '/api/social/ai/provider';

function providerLabel(provider: AiProvider): string {
  return AI_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label ?? provider;
}

export function AiProviderSettings() {
  const scopeKey = useClientScopeKey();
  const { mutate } = useSWRConfig();
  const [display, setDisplay] = useState<AiProviderDisplay | null>(null);
  const [provider, setProvider] = useState<AiProvider>('anthropic');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [testReply, setTestReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refreshAiStatus() {
    void mutate([AI_API_ROUTE, scopeKey]);
  }

  function applyDisplay(data: AiProviderDisplay) {
    setDisplay(data);
    setProvider(data.provider ?? data.effective?.provider ?? 'anthropic');
    setModel(data.model ?? '');
    setApiKey(data.apiKey ?? '');
  }

  useEffect(() => {
    setStatus(null);
    setTestReply(null);
    setApiKey('');
    setShowKey(false);
    void fetch(PROVIDER_ROUTE)
      .then((response) => response.json())
      .then((data: AiProviderDisplay) => applyDisplay(data))
      .catch(() => setStatus('Could not load the AI provider settings'));
  }, [scopeKey]);

  const option = AI_PROVIDER_OPTIONS.find((item) => item.value === provider);
  const clientReady = display?.level === 'client';
  const scopeNoun = clientReady ? 'this client' : 'the selected client';

  async function readJson(response: Response) {
    const text = await response.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      const hint = text.trimStart().startsWith('<')
        ? `Server returned an HTML error page (HTTP ${response.status}). Pull the latest build on the server and restart PM2.`
        : `Bad response from server (HTTP ${response.status}).`;
      throw new Error(hint);
    }
  }

  async function test() {
    if (!apiKey.trim()) {
      setStatus('Enter the API key you want to test first.');
      setTestReply(null);
      return;
    }
    setBusy(true);
    setStatus('Testing the key…');
    setTestReply(null);
    try {
      const response = await fetch(`${PROVIDER_ROUTE}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model: model.trim() || undefined, apiKey: apiKey.trim() }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Test failed');
      }
      if (payload.ok === true && typeof payload.reply === 'string') {
        setStatus(`Key works on ${typeof payload.model === 'string' ? payload.model : provider}.`);
        setTestReply(payload.reply);
        return;
      }
      setStatus(typeof payload.error === 'string' ? payload.error : 'Key did not work.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Test failed');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(PROVIDER_ROUTE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as AiProviderDisplay & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Save failed');
      applyDisplay(payload);
      refreshAiStatus();
      setStatus(`Saved. ${providerLabel(provider)} will be used for ${scopeNoun}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(PROVIDER_ROUTE, { method: 'DELETE' });
      const payload = (await response.json()) as AiProviderDisplay & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not remove');
      applyDisplay(payload);
      setShowKey(false);
      refreshAiStatus();
      setStatus('Removed. This level now inherits the fallback provider.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not remove');
    } finally {
      setBusy(false);
    }
  }

  const keyPlaceholder = display?.provider
    ? display.keyLast4
      ? `Key set (ends ${display.keyLast4}) — leave blank to keep`
      : (option?.keyHint ?? 'API key')
    : (option?.keyHint ?? 'API key');

  return (
    <section className="border-border bg-surface space-y-4 rounded-2xl border p-4">
      <div>
        <h2 className="text-sm font-semibold">AI provider</h2>
        <p className="text-muted-foreground text-xs">
          Add a ChatGPT, Claude or Gemini key for one client. Every other client uses the server
          env key. The Copilot chat always uses Claude.
        </p>
      </div>

      {display?.effective ? (
        <p className="text-muted-foreground text-xs">
          Currently using{' '}
          <span className="font-medium">{providerLabel(display.effective.provider)}</span> (
          {display.effective.model}) — from{' '}
          {display.effective.source === 'env' ? 'the server default' : display.effective.source}.
        </p>
      ) : (
        <p className="text-xs text-amber-600">No AI provider is configured yet.</p>
      )}

      {!clientReady ? (
        <p className="text-xs text-amber-600">
          Pick a client in the switcher to add their API key. The env key stays the fallback for
          all clients.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="text-muted-foreground mb-1 block text-xs font-medium">Provider</span>
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as AiProvider)}
                className="border-border bg-surface-muted/40 h-10 w-full rounded-xl border px-3 text-sm outline-none"
              >
                {AI_PROVIDER_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-muted-foreground mb-1 block text-xs font-medium">
                Model <span className="font-normal">(optional)</span>
              </span>
              <input
                value={model}
                placeholder={option?.modelPlaceholder}
                onChange={(event) => setModel(event.target.value)}
                className="border-border bg-surface-muted/40 h-10 w-full rounded-xl border px-3 text-sm outline-none"
              />
            </label>

            <label className="md:col-span-2">
              <span className="text-muted-foreground mb-1 block text-xs font-medium">API key</span>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKey}
                  placeholder={keyPlaceholder}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="border-border bg-surface-muted/40 h-10 w-full rounded-xl border px-3 pr-11 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((open) => !open)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5"
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void save()} disabled={busy}>
              {busy ? 'Working…' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void test()} disabled={busy}>
              Test key
            </Button>
            {display?.provider && (
              <Button type="button" variant="ghost" onClick={() => void remove()} disabled={busy}>
                Remove
              </Button>
            )}
            {status && <p className="text-muted-foreground text-xs">{status}</p>}
          </div>

          {testReply && (
            <div className="border-border bg-surface-muted/40 space-y-2 rounded-2xl border p-3">
              <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                Quick check chat
              </p>
              <div className="bg-surface ml-auto max-w-[90%] rounded-2xl rounded-br-md border border-border px-3 py-2 text-xs">
                Say hello and confirm the API key works.
              </div>
              <div className="bg-primary/10 text-foreground mr-auto max-w-[90%] rounded-2xl rounded-bl-md px-3 py-2 text-xs">
                {testReply}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
