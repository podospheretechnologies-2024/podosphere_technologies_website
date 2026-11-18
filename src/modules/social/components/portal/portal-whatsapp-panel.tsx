'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';
import type {
  PortalWhatsAppAutomation,
  PortalWhatsAppBroadcastRow,
  PortalWhatsAppConversationDetail,
  PortalWhatsAppConversationRow,
  PortalWhatsAppMessageRow,
  PortalWhatsAppSummary,
  PortalWhatsAppTemplateRow,
} from '@/modules/social/server/portal/portal-whatsapp.service';

type Section = 'overview' | 'chats' | 'templates' | 'broadcasts' | 'automation';

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function qualityLabel(rating: string | null): string {
  if (!rating || rating === 'UNKNOWN') return '—';
  return rating.charAt(0) + rating.slice(1).toLowerCase();
}

function tierLabel(tier: string | null): string {
  if (!tier) return '—';
  return tier.replace(/^TIER_/, '').replace(/_/g, ' ');
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending_approval':
      return 'Waiting for agency';
    case 'cancelled':
      return 'Rejected';
    case 'sent':
      return 'Sent';
    case 'partial':
      return 'Partially sent';
    case 'sending':
      return 'Sending';
    default:
      return status;
  }
}

const MATCH_LABELS: Record<string, string> = {
  keyword: 'Keyword',
  regex: 'Regex',
};

const REPLY_LABELS: Record<string, string> = {
  text: 'Text reply',
  template: 'Template reply',
};

export function PortalWhatsAppPanel({
  data,
  canAct = false,
}: {
  data: PortalWhatsAppSummary;
  /** True when the agency set WhatsApp to "Can act". */
  canAct?: boolean;
}) {
  const [section, setSection] = useState<Section>('overview');
  const [summary, setSummary] = useState(data);
  const [orderDays, setOrderDays] = useState<7 | 30>(data.orderFlows?.days ?? 30);
  const [loadingOrderDays, setLoadingOrderDays] = useState(false);
  const [conversations, setConversations] = useState<PortalWhatsAppConversationRow[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PortalWhatsAppConversationDetail | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<PortalWhatsAppTemplateRow[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PortalWhatsAppTemplateRow | null>(null);
  const [templateTo, setTemplateTo] = useState('');
  const [templateVars, setTemplateVars] = useState<string[]>([]);
  const [broadcasts, setBroadcasts] = useState<PortalWhatsAppBroadcastRow[]>([]);
  const [broadcastsLoaded, setBroadcastsLoaded] = useState(false);
  const [broadcastName, setBroadcastName] = useState('');
  const [broadcastTemplate, setBroadcastTemplate] = useState<PortalWhatsAppTemplateRow | null>(
    null
  );
  const [broadcastPhones, setBroadcastPhones] = useState('');
  const [broadcastVars, setBroadcastVars] = useState<string[]>([]);
  const [broadcastConsent, setBroadcastConsent] = useState(false);
  const [automation, setAutomation] = useState<PortalWhatsAppAutomation | null>(null);
  const [automationLoaded, setAutomationLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (section !== 'chats' || chatsLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const payload = await apiFetch<{ conversations: PortalWhatsAppConversationRow[] }>(
          '/api/portal/whatsapp/conversations'
        );
        if (!cancelled) {
          setConversations(payload.conversations);
          setChatsLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load chats');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, chatsLoaded]);

  useEffect(() => {
    if ((section !== 'templates' && section !== 'broadcasts') || templatesLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const payload = await apiFetch<{ templates: PortalWhatsAppTemplateRow[] }>(
          '/api/portal/whatsapp/templates'
        );
        if (!cancelled) {
          setTemplates(payload.templates);
          setTemplatesLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load templates');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, templatesLoaded]);

  useEffect(() => {
    if (section !== 'broadcasts' || broadcastsLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const payload = await apiFetch<{ broadcasts: PortalWhatsAppBroadcastRow[] }>(
          '/api/portal/whatsapp/broadcasts'
        );
        if (!cancelled) {
          setBroadcasts(payload.broadcasts);
          setBroadcastsLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load broadcasts');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, broadcastsLoaded]);

  useEffect(() => {
    if (section !== 'automation' || automationLoaded) return;
    let cancelled = false;
    void (async () => {
      try {
        const payload = await apiFetch<PortalWhatsAppAutomation>(
          '/api/portal/whatsapp/automation'
        );
        if (!cancelled) {
          setAutomation(payload);
          setAutomationLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load automation');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, automationLoaded]);

  async function refreshOrderDays(days: 7 | 30) {
    setLoadingOrderDays(true);
    setError(null);
    try {
      const payload = await apiFetch<PortalWhatsAppSummary>(`/api/portal/whatsapp?days=${days}`);
      setSummary(payload);
      setOrderDays(payload.orderFlows?.days ?? days);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not refresh order recovery');
    } finally {
      setLoadingOrderDays(false);
    }
  }

  async function openConversation(conversationId: string) {
    setSelectedId(conversationId);
    setLoadingChat(true);
    setError(null);
    setReplyText('');
    try {
      const payload = await apiFetch<PortalWhatsAppConversationDetail>(
        `/api/portal/whatsapp/conversations/${conversationId}`
      );
      setDetail(payload);
    } catch (err) {
      setDetail(null);
      setError(err instanceof ApiError ? err.message : 'Could not load conversation');
    } finally {
      setLoadingChat(false);
    }
  }

  function closeConversation() {
    setSelectedId(null);
    setDetail(null);
    setReplyText('');
  }

  async function sendReply() {
    if (!selectedId || !canAct) return;
    const text = replyText.trim();
    if (!text) return;

    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{
        conversation: PortalWhatsAppConversationRow;
        message: PortalWhatsAppMessageRow;
        sendsUsedToday: number;
        dailyCap: number;
      }>(`/api/portal/whatsapp/conversations/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      setConversations((rows) =>
        rows.map((row) => (row.id === res.conversation.id ? { ...row, ...res.conversation } : row))
      );
      setDetail((current) =>
        current && current.conversation.id === res.conversation.id
          ? {
              conversation: res.conversation,
              messages: [...current.messages, res.message],
            }
          : current
      );
      setSummary((current) => ({
        ...current,
        sendsUsedToday: res.sendsUsedToday,
        dailyCap: res.dailyCap,
      }));
      setReplyText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send reply.');
    } finally {
      setSending(false);
    }
  }

  function pickTemplate(template: PortalWhatsAppTemplateRow) {
    setSelectedTemplate(template);
    setTemplateVars(Array.from({ length: template.variablesCount }, () => ''));
    setNotice(null);
    setError(null);
  }

  function pickBroadcastTemplate(template: PortalWhatsAppTemplateRow) {
    setBroadcastTemplate(template);
    setBroadcastVars(Array.from({ length: template.variablesCount }, () => ''));
    setError(null);
    setNotice(null);
  }

  async function sendTemplate() {
    if (!canAct || !selectedTemplate) return;
    const to = templateTo.trim();
    if (!to) {
      setError('Enter the recipient phone number with country code.');
      return;
    }
    if (templateVars.some((value) => !value.trim())) {
      setError('Fill in every template variable.');
      return;
    }

    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{
        messageId: string;
        sendsUsedToday: number;
        dailyCap: number;
      }>('/api/portal/whatsapp/templates/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          templateName: selectedTemplate.name,
          language: selectedTemplate.language,
          variables: templateVars.map((value) => value.trim()),
        }),
      });
      setSummary((current) => ({
        ...current,
        sendsUsedToday: res.sendsUsedToday,
        dailyCap: res.dailyCap,
      }));
      setNotice(`Template sent to ${to}.`);
      setTemplateVars(Array.from({ length: selectedTemplate.variablesCount }, () => ''));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send template.');
    } finally {
      setSending(false);
    }
  }

  async function submitBroadcast() {
    if (!canAct || !broadcastTemplate) return;
    const phones = broadcastPhones
      .split(/[\s,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!broadcastName.trim()) {
      setError('Name this broadcast.');
      return;
    }
    if (phones.length === 0) {
      setError('Paste at least one recipient phone number.');
      return;
    }
    if (broadcastVars.some((value) => !value.trim())) {
      setError('Fill in every template variable.');
      return;
    }
    if (!broadcastConsent) {
      setError('Confirm that recipients consented to WhatsApp marketing messages.');
      return;
    }

    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch<{
        id: string;
        status?: string;
        needsApproval: boolean;
        recipientCount?: number;
        sent?: number;
        total?: number;
        sendsUsedToday: number;
        dailyCap: number;
      }>('/api/portal/whatsapp/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: broadcastName.trim(),
          templateName: broadcastTemplate.name,
          language: broadcastTemplate.language,
          phones,
          variables: broadcastVars.map((value) => value.trim()),
          consentAcknowledged: true,
        }),
      });
      setSummary((current) => ({
        ...current,
        sendsUsedToday: res.sendsUsedToday,
        dailyCap: res.dailyCap,
        broadcastsSent:
          res.needsApproval || !res.sent
            ? current.broadcastsSent
            : current.broadcastsSent + (res.sent ?? 0),
      }));
      setNotice(
        res.needsApproval
          ? `Broadcast submitted for agency approval (${res.recipientCount ?? phones.length} recipients).`
          : `Broadcast sent to ${res.sent ?? 0}/${res.total ?? phones.length} recipients.`
      );
      setBroadcastName('');
      setBroadcastPhones('');
      setBroadcastConsent(false);
      setBroadcastVars(
        Array.from({ length: broadcastTemplate.variablesCount }, () => '')
      );
      setBroadcastsLoaded(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit broadcast.');
    } finally {
      setSending(false);
    }
  }

  const orderFlows = summary.orderFlows;
  const tabs: { id: Section; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'chats', label: 'Chats' },
    { id: 'templates', label: 'Templates' },
    { id: 'broadcasts', label: 'Broadcasts' },
    { id: 'automation', label: 'Automation' },
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">WhatsApp</h2>
        <p className="mt-1 text-muted-foreground">
          {canAct
            ? 'Your number, chats, templates, and broadcasts — reply and send when allowed.'
            : 'Your number, chats, templates, and automation (view only).'}
        </p>
      </div>

      <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto border-b border-border pb-3 [scrollbar-width:thin]">
        {tabs.map((tab) => {
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSection(tab.id);
                setError(null);
                setNotice(null);
              }}
              className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-foreground text-background'
                  : 'bg-surface-muted text-foreground hover:bg-surface-muted'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && section === 'overview' ? (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      ) : null}

      {section === 'overview' ? (
        <>
          {!summary.connected || !summary.number ? (
            <div className="mb-8 rounded-xl border border-border bg-surface p-8 text-center sm:p-12">
              <p className="text-muted-foreground">
                Ask your agency to link a WhatsApp number to your brand.
              </p>
              <button
                type="button"
                disabled
                className="mt-4 min-h-11 w-full max-w-xs rounded-lg bg-surface-muted px-4 py-2.5 text-sm font-medium text-muted-foreground sm:w-auto"
              >
                Connect WhatsApp
              </button>
              <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground">
                Your agency links the number until Meta App Review is approved.
              </p>
            </div>
          ) : (
            <div className="mb-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Linked number</p>
              <p className="mt-1 text-xl font-semibold text-foreground">
                {summary.number.displayPhone || 'WhatsApp number'}
              </p>
              {summary.number.businessName ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{summary.number.businessName}</p>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Quality rating</p>
                  <p className="text-sm font-medium text-foreground">
                    {qualityLabel(summary.number.qualityRating)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Messaging limit</p>
                  <p className="text-sm font-medium text-foreground">
                    {tierLabel(summary.number.messagingLimitTier)}
                  </p>
                </div>
              </div>
              {canAct ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Sends today: {summary.sendsUsedToday} / {summary.dailyCap}
                </p>
              ) : null}
              <div className="mt-5 border-t border-border pt-4">
                <button
                  type="button"
                  disabled
                  className="min-h-11 w-full rounded-lg bg-surface-muted px-4 py-2.5 text-sm font-medium text-muted-foreground sm:w-auto"
                >
                  Connect WhatsApp
                </button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Your agency links the number until Meta App Review is approved.
                </p>
              </div>
            </div>
          )}

          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Sent (30d)</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {summary.stats30d.sent.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Delivered (30d)</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {summary.stats30d.delivered.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Replied (30d)</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {summary.stats30d.replied.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Leads messaged</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{summary.leadsMessaged}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Lead replies</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{summary.replies}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">Broadcasts sent</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{summary.broadcastsSent}</p>
            </div>
          </div>

          {orderFlows ? (
            <div className="mb-2">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Order recovery</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Messages and carts recovered from abandoned checkouts (read-only).
                  </p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  {([7, 30] as const).map((days) => {
                    const active = orderDays === days;
                    return (
                      <button
                        key={days}
                        type="button"
                        disabled={loadingOrderDays}
                        onClick={() => void refreshOrderDays(days)}
                        className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-medium sm:flex-none ${
                          active
                            ? 'bg-foreground text-background'
                            : 'bg-surface-muted text-foreground hover:bg-surface-muted'
                        } disabled:opacity-50`}
                      >
                        {days} days
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <p className="text-sm text-muted-foreground">Messages sent</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {orderFlows.messagesSent.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <p className="text-sm text-muted-foreground">Carts recovered</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {orderFlows.cartsRecovered.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <p className="text-sm text-muted-foreground">Revenue recovered</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {formatInr(orderFlows.revenueRecovered)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <p className="text-sm text-muted-foreground">Spend estimate</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {orderFlows.moneySpentEstimate > 0
                      ? formatInr(orderFlows.moneySpentEstimate)
                      : '–'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {section === 'chats' ? (
        <>
          {!summary.connected ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              Ask your agency to link a WhatsApp number to your brand.
            </div>
          ) : !chatsLoaded ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              Loading chats…
            </div>
          ) : conversations.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              No chats yet for your number.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <ul
                className={`max-h-[70vh] divide-y divide-border overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-surface ${
                  selectedId ? 'hidden lg:block' : 'block'
                }`}
              >
                {conversations.map((conversation) => {
                  const active = conversation.id === selectedId;
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => void openConversation(conversation.id)}
                        className={`flex min-h-14 w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
                          active ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-medium text-foreground">
                            {conversation.contactName || conversation.contactPhone}
                          </p>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatWhen(conversation.lastMessageAt)}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {conversation.lastPreview || 'No preview'}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {conversation.withinWindow ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
                              Open window
                            </span>
                          ) : (
                            <span className="rounded-full bg-surface-muted px-2 py-0.5 font-medium text-muted-foreground">
                              Template only
                            </span>
                          )}
                          {conversation.unreadCount > 0 ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                              {conversation.unreadCount} new
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div
                className={`min-w-0 rounded-xl border border-border bg-surface ${
                  selectedId ? 'block' : 'hidden lg:block'
                }`}
              >
                {!selectedId ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Select a conversation to read the messages.
                  </div>
                ) : loadingChat ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
                ) : error && !detail ? (
                  <div className="p-8 text-center text-sm text-red-600">{error}</div>
                ) : detail ? (
                  <div className="flex h-full min-h-[280px] flex-col">
                    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {detail.conversation.contactName || detail.conversation.contactPhone}
                        </p>
                        <p className="text-xs text-muted-foreground">{detail.conversation.contactPhone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={closeConversation}
                        className="min-h-10 shrink-0 px-2 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden"
                      >
                        Back
                      </button>
                    </div>

                    <div className="max-h-[50vh] flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-4">
                      {detail.messages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No messages in this chat.</p>
                      ) : (
                        detail.messages.map((message) => {
                          const outbound = message.direction === 'outbound';
                          return (
                            <div
                              key={message.id}
                              className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                  outbound
                                    ? 'bg-foreground text-background'
                                    : 'bg-surface-muted text-foreground'
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                                <p
                                  className={`mt-1 text-[10px] ${
                                    outbound ? 'text-background/70' : 'text-muted-foreground'
                                  }`}
                                >
                                  {formatWhen(message.timestamp)}
                                  {message.status ? ` · ${message.status}` : ''}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {canAct ? (
                      <div className="border-t border-border px-4 py-3">
                        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
                        {!detail.conversation.withinWindow ? (
                          <p className="mb-2 text-xs text-amber-700">
                            The 24-hour window is closed. Use Templates to message this contact.
                          </p>
                        ) : null}
                        <label className="block text-xs font-medium text-muted-foreground">
                          Reply
                          <textarea
                            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                            rows={3}
                            value={replyText}
                            onChange={(event) => setReplyText(event.target.value)}
                            placeholder="Write a reply…"
                            maxLength={8000}
                            disabled={sending || !detail.conversation.withinWindow}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void sendReply()}
                          disabled={
                            sending ||
                            !replyText.trim() ||
                            !detail.conversation.withinWindow
                          }
                          className="mt-2 min-h-11 w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
                        >
                          {sending ? 'Sending…' : 'Send reply'}
                        </button>
                      </div>
                    ) : (
                      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                        Your agency has set WhatsApp to view only. Ask them to enable “Can act” if
                        you need to reply.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </>
      ) : null}

      {section === 'templates' ? (
        <>
          {!summary.connected ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              Ask your agency to link a WhatsApp number to your brand.
            </div>
          ) : !templatesLoaded ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              No approved templates on your number yet.
            </div>
          ) : (
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ul
                className={`divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface ${
                  selectedTemplate ? 'hidden lg:block' : 'block'
                }`}
              >
                {templates.map((template) => {
                  const active =
                    selectedTemplate?.name === template.name &&
                    selectedTemplate?.language === template.language;
                  return (
                    <li key={`${template.name}:${template.language}`}>
                      <button
                        type="button"
                        onClick={() => pickTemplate(template)}
                        className={`min-h-14 w-full px-4 py-3 text-left transition-colors ${
                          active ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                        }`}
                      >
                        <p className="truncate text-sm font-medium text-foreground">
                          {template.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {template.language} · {template.category}
                          {template.variablesCount > 0
                            ? ` · ${template.variablesCount} variable${
                                template.variablesCount === 1 ? '' : 's'
                              }`
                            : ''}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {template.bodyPreview || 'No body preview'}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div
                className={`min-w-0 rounded-xl border border-border bg-surface p-4 ${
                  selectedTemplate ? 'block' : 'hidden lg:block'
                }`}
              >
                {!selectedTemplate ? (
                  <p className="text-sm text-muted-foreground">Select a template to preview and send.</p>
                ) : (
                  <>
                    <div className="mb-3 flex items-start justify-between gap-3 lg:mb-0">
                      <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {selectedTemplate.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedTemplate(null)}
                        className="min-h-10 shrink-0 px-2 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden"
                      >
                        Back
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {selectedTemplate.bodyPreview}
                    </p>

                    {canAct ? (
                      <div className="mt-4 space-y-3">
                        {error ? <p className="text-sm text-red-600">{error}</p> : null}
                        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
                        <label className="block text-xs font-medium text-muted-foreground">
                          Recipient phone
                          <input
                            type="text"
                            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                            value={templateTo}
                            onChange={(event) => setTemplateTo(event.target.value)}
                            placeholder="919876543210"
                            disabled={sending}
                          />
                        </label>
                        {selectedTemplate.variables.map((variable, index) => (
                          <label
                            key={`${variable}-${index}`}
                            className="block text-xs font-medium text-muted-foreground"
                          >
                            {variable || `Variable ${index + 1}`}
                            <input
                              type="text"
                              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                              value={templateVars[index] ?? ''}
                              onChange={(event) => {
                                const next = [...templateVars];
                                next[index] = event.target.value;
                                setTemplateVars(next);
                              }}
                              disabled={sending}
                            />
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() => void sendTemplate()}
                          disabled={sending}
                          className="min-h-11 w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
                        >
                          {sending ? 'Sending…' : 'Send template'}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          Sends today: {summary.sendsUsedToday} / {summary.dailyCap}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-muted-foreground">
                        Your agency has set WhatsApp to view only. Ask them to enable “Can act” to
                        send templates.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}

      {section === 'broadcasts' ? (
        <>
          {!summary.connected ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              Ask your agency to link a WhatsApp number to your brand.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-4">
                <div className="rounded-xl border border-border bg-surface p-4">
                  <h3 className="text-sm font-semibold text-foreground">Your broadcasts</h3>
                  {!broadcastsLoaded ? (
                    <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
                  ) : broadcasts.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">No broadcasts yet.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-border">
                      {broadcasts.map((row) => (
                        <li key={row.id} className="py-3">
                          <p className="text-sm font-medium text-foreground">{row.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {row.templateName} · {row.language} · {statusLabel(row.status)} ·{' '}
                            {row.sentCount}/{row.recipientCount}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatWhen(row.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {summary.broadcastNeedsApproval
                    ? 'Prepare a broadcast'
                    : 'Send a broadcast'}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary.broadcastNeedsApproval
                    ? 'Your agency must approve before messages go out.'
                    : 'Sends immediately under your daily cap.'}
                </p>

                {canAct ? (
                  <div className="mt-4 space-y-3">
                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
                    <label className="block text-xs font-medium text-muted-foreground">
                      Campaign name
                      <input
                        type="text"
                        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                        value={broadcastName}
                        onChange={(event) => setBroadcastName(event.target.value)}
                        disabled={sending}
                      />
                    </label>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Template</p>
                      {!templatesLoaded ? (
                        <p className="text-sm text-muted-foreground">Loading templates…</p>
                      ) : (
                        <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                          {templates.map((template) => {
                            const active =
                              broadcastTemplate?.name === template.name &&
                              broadcastTemplate?.language === template.language;
                            return (
                              <li key={`bc-${template.name}:${template.language}`}>
                                <button
                                  type="button"
                                  onClick={() => pickBroadcastTemplate(template)}
                                  className={`w-full px-3 py-2 text-left text-sm ${
                                    active ? 'bg-surface-muted font-medium' : 'hover:bg-surface-muted'
                                  }`}
                                >
                                  {template.name}
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    ({template.language})
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    {broadcastTemplate
                      ? broadcastTemplate.variables.map((variable, index) => (
                          <label
                            key={`bc-var-${variable}-${index}`}
                            className="block text-xs font-medium text-muted-foreground"
                          >
                            {variable || `Variable ${index + 1}`}
                            <input
                              type="text"
                              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                              value={broadcastVars[index] ?? ''}
                              onChange={(event) => {
                                const next = [...broadcastVars];
                                next[index] = event.target.value;
                                setBroadcastVars(next);
                              }}
                              disabled={sending}
                            />
                          </label>
                        ))
                      : null}
                    <label className="block text-xs font-medium text-muted-foreground">
                      Recipient phones
                      <textarea
                        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                        rows={4}
                        value={broadcastPhones}
                        onChange={(event) => setBroadcastPhones(event.target.value)}
                        placeholder="One per line, with country code"
                        disabled={sending}
                      />
                    </label>
                    <label className="flex items-start gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={broadcastConsent}
                        onChange={(event) => setBroadcastConsent(event.target.checked)}
                        disabled={sending}
                      />
                      I confirm these recipients opted in to WhatsApp messages and can opt out
                      via STOP.
                    </label>
                    <button
                      type="button"
                      onClick={() => void submitBroadcast()}
                      disabled={sending || !broadcastTemplate}
                      className="min-h-11 w-full rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
                    >
                      {sending
                        ? 'Submitting…'
                        : summary.broadcastNeedsApproval
                          ? 'Submit for approval'
                          : 'Send broadcast'}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      Sends today: {summary.sendsUsedToday} / {summary.dailyCap}
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Your agency has set WhatsApp to view only. Ask them to enable “Can act” to
                    prepare broadcasts.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}

      {section === 'automation' ? (
        <>
          {!automationLoaded ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              Loading automation…
            </div>
          ) : !automation ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center text-muted-foreground">
              Could not load automation.
            </div>
          ) : (
            <div className="space-y-8">
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <section>
                <h3 className="mb-3 text-lg font-semibold text-foreground">Auto-replies</h3>
                {automation.autoReplies.length === 0 ? (
                  <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
                    No auto-reply rules for your brand.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {automation.autoReplies.map((rule) => (
                      <article
                        key={rule.id}
                        className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {rule.name}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {MATCH_LABELS[rule.matchType] ?? rule.matchType}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                              rule.active
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-surface-muted text-muted-foreground'
                            }`}
                          >
                            {rule.active ? 'Active' : 'Off'}
                          </span>
                        </div>
                        <p className="mt-3 break-all rounded-lg bg-surface-muted px-3 py-2 font-mono text-xs text-foreground">
                          {rule.pattern}
                        </p>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {REPLY_LABELS[rule.replyType] ?? rule.replyType}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-lg font-semibold text-foreground">Lead flow</h3>
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">Automatic lead messages</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        automation.leadFlow.enabled
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-surface-muted text-muted-foreground'
                      }`}
                    >
                      {automation.leadFlow.enabled ? 'On' : 'Off'}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <li>
                      Welcome:{' '}
                      {automation.leadFlow.welcomeTemplate || '—'}
                    </li>
                    <li>
                      Follow-up 1:{' '}
                      {automation.leadFlow.followUp1Template || '—'}
                    </li>
                    <li>
                      Follow-up 2:{' '}
                      {automation.leadFlow.followUp2Template || '—'}
                    </li>
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Read-only — ask your agency to change these rules.
                  </p>
                </div>
              </section>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
