'use client';

import { Link2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { SHORT_LINK_DEFAULT_MEDIUM } from '../../../config/short-links';
import { createShortLink } from '../../../lib/short-links.client';
import type { ChannelItem } from '../../../types/integration';

interface UtmShortLinkProps {
  channels: ChannelItem[];
  disabled?: boolean;
  onInsert: (shortUrl: string) => void;
}

function campaignSlug(name: string | null | undefined): string {
  if (!name?.trim()) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function UtmShortLink({ channels, disabled, onInsert }: UtmShortLinkProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [channelId, setChannelId] = useState(() => channels[0]?.id ?? '');
  const [campaign, setCampaign] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!channels.some((channel) => channel.id === channelId)) {
      setChannelId(channels[0]?.id ?? '');
    }
  }, [channels, channelId]);

  const selected = useMemo(
    () => channels.find((channel) => channel.id === channelId) ?? channels[0] ?? null,
    [channelId, channels]
  );

  if (channels.length === 0) {
    return null;
  }

  async function shorten() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const utmCampaign =
        campaign.trim() || campaignSlug(selected.customer?.name) || undefined;
      const link = await createShortLink({
        targetUrl: url.trim(),
        utmSource: selected.providerIdentifier,
        utmMedium: SHORT_LINK_DEFAULT_MEDIUM,
        utmCampaign,
      });
      onInsert(link.shortUrl);
      setUrl('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not shorten link');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Link2 className="size-3.5" />
        UTM + short link
      </Button>

      {open && (
        <div className="border-border bg-surface absolute bottom-full left-0 z-20 mb-2 w-80 space-y-2 rounded-xl border p-3 shadow-lg">
          <p className="text-muted-foreground text-xs">
            Adds <code className="text-foreground">utm_source</code> for the channel and inserts
            a tracked <code className="text-foreground">/l/…</code> link.
          </p>
          <Input
            type="url"
            placeholder="https://example.com/offer"
            value={url}
            disabled={busy}
            onChange={(event) => setUrl(event.target.value)}
          />
          <select
            value={selected?.id ?? ''}
            disabled={busy || channels.length === 1}
            aria-label="Channel for utm_source"
            onChange={(event) => setChannelId(event.target.value)}
            className="border-border bg-surface h-10 w-full rounded-lg border px-3 text-sm outline-none"
          >
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.providerName} · {channel.name}
              </option>
            ))}
          </select>
          <Input
            placeholder={
              selected?.customer?.name
                ? `Campaign (default: ${campaignSlug(selected.customer.name)})`
                : 'utm_campaign (optional)'
            }
            value={campaign}
            disabled={busy}
            onChange={(event) => setCampaign(event.target.value)}
          />
          {error && <p className="text-danger text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !url.trim()}
              onClick={() => void shorten()}
            >
              {busy ? 'Shortening…' : 'Shorten & insert'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
