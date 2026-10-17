'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Check, Link as LinkIcon, Radio, Sparkles } from 'lucide-react';
import { apiFetch } from '@/shared/lib/fetcher';
import { useClientScope, useClientScopeKey } from '@/modules/social/hooks/use-client-scope';
import {
  ONBOARDING_STEPS,
  type OnboardingStep,
} from '@/modules/social/config/client-onboarding';

const STEP_META: Record<
  OnboardingStep,
  { title: string; description: string }
> = {
  created: {
    title: 'Client created',
    description: 'Profile is ready. Next, share a portal connect link.',
  },
  connect_link: {
    title: 'Share connect link',
    description: 'Copy the magic link so the client can open the portal and connect channels.',
  },
  channels: {
    title: 'Channels connected',
    description: 'Confirm at least one social channel is linked to this client.',
  },
  brand_kit: {
    title: 'Brand kit',
    description: 'Open the AI brand kit and fill voice, audience, and compliance notes.',
  },
  done: {
    title: 'Onboarding complete',
    description: 'This client is ready for day-to-day work.',
  },
};

function stepIndex(step: string): number {
  const i = (ONBOARDING_STEPS as readonly string[]).indexOf(step);
  return i >= 0 ? i : 0;
}

export default function ClientOnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const scopeKey = useClientScopeKey();
  const { setSelectedClientId } = useClientScope();
  const { data: client, mutate, isLoading } = useSWR<any>(
    [`/api/social/clients/${id}/onboarding`, scopeKey],
    ([url]) => apiFetch(url)
  );
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = (client?.onboardingStep ?? 'created') as OnboardingStep;
  const currentIdx = stepIndex(current);

  async function persistStep(step: OnboardingStep) {
    await apiFetch(`/api/social/clients/${id}/onboarding`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step }),
    });
    await mutate();
  }

  async function setStep(step: OnboardingStep) {
    setSaving(true);
    try {
      await persistStep(step);
    } finally {
      setSaving(false);
    }
  }

  async function copyMagicLink() {
    setSaving(true);
    try {
      const res = (await apiFetch(`/api/social/clients/${id}/magic-link`, {
        method: 'POST',
      })) as { magicLink: string };
      await navigator.clipboard.writeText(res.magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (currentIdx < stepIndex('connect_link')) {
        await persistStep('connect_link');
      }
    } finally {
      setSaving(false);
    }
  }

  async function markChannelsDone() {
    await setStep('channels');
  }

  async function openBrandKit() {
    setSaving(true);
    try {
      await setSelectedClientId(id);
      if (currentIdx < stepIndex('brand_kit')) {
        await persistStep('brand_kit');
      }
      router.push('/dashboard/social/ai');
    } finally {
      setSaving(false);
    }
  }

  async function markDone() {
    await setStep('done');
  }

  if (isLoading || !client) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center text-muted-foreground">
        Loading onboarding…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/dashboard/social/clients"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Clients
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Onboard {client.name}</h1>
        <p className="mt-1 text-muted-foreground">
          Walk through connect link, channels, and brand kit. OAuth stays on the existing portal —
          this wizard only tracks progress.
        </p>
      </div>

      <ol className="space-y-3">
        {ONBOARDING_STEPS.map((step, idx) => {
          const meta = STEP_META[step];
          const done = idx < currentIdx || current === 'done';
          const active = step === current;
          return (
            <li
              key={step}
              className={`rounded-xl border px-4 py-3 ${
                active ? 'border-primary/40 bg-primary/5' : 'bg-surface'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    done || active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-muted text-muted-foreground'
                  }`}
                >
                  {done && !active ? <Check className="size-3.5" /> : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{meta.title}</p>
                  <p className="text-sm text-muted-foreground">{meta.description}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="space-y-3 rounded-xl border bg-surface p-5">
        <h2 className="font-medium">Actions</h2>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyMagicLink}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-3 py-2 text-sm font-medium shadow-sm hover:bg-surface-muted disabled:opacity-60"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-green-500" /> Link copied
              </>
            ) : (
              <>
                <LinkIcon className="size-3.5" /> Copy magic link
              </>
            )}
          </button>

          <button
            type="button"
            onClick={markChannelsDone}
            disabled={saving || (client.integrations?.length ?? 0) === 0}
            className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-3 py-2 text-sm font-medium shadow-sm hover:bg-surface-muted disabled:opacity-60"
            title={
              (client.integrations?.length ?? 0) === 0
                ? 'Link a channel first (via portal or Channels page)'
                : undefined
            }
          >
            <Radio className="size-3.5" />
            Mark channels connected
            {(client.integrations?.length ?? 0) > 0
              ? ` (${client.integrations.length})`
              : ''}
          </button>

          <button
            type="button"
            onClick={openBrandKit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md border bg-surface px-3 py-2 text-sm font-medium shadow-sm hover:bg-surface-muted disabled:opacity-60"
          >
            <Sparkles className="size-3.5" /> Open brand kit
          </button>

          {current !== 'done' ? (
            <button
              type="button"
              onClick={markDone}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              Mark complete
            </button>
          ) : null}
        </div>

        {(client.integrations?.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">
            No channels linked yet. Send the magic link so the client can connect via the portal, or
            assign a channel from{' '}
            <Link href="/dashboard/social/channels" className="underline">
              Channels
            </Link>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
