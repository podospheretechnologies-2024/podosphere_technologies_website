'use client';

import useSWR from 'swr';
import { Card } from '@/shared/components/ui/card';
import { fetcher } from '@/shared/lib/fetcher';
import { useClientScopeKey } from '../../hooks/use-client-scope';
import type { WhatsAppAdChatRow } from '../../types/whatsapp-agency';

const ROUTE = '/api/social/whatsapp/ad-chats';

export function AdChatsCard() {
  const scopeKey = useClientScopeKey();
  const { data, isLoading } = useSWR<WhatsAppAdChatRow[]>(
    scopeKey ? `${ROUTE}?${scopeKey}` : null,
    fetcher
  );

  return (
    <Card className="space-y-3 p-6">
      <div>
        <h2 className="text-sm font-semibold">Chats from ads</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Click-to-WhatsApp ads that opened a chat with the connected number.
        </p>
      </div>
      {isLoading && !data ? (
        <p className="text-muted-foreground text-xs">Loading…</p>
      ) : !data?.length ? (
        <p className="text-muted-foreground text-xs">
          No ad chats yet. When someone taps a click-to-WhatsApp ad, it shows here and as a lead.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr className="border-border border-b">
                <th className="py-2 pr-3 font-medium">Ad</th>
                <th className="py-2 pr-3 font-medium">Chats</th>
                <th className="py-2 pr-3 font-medium">Replies</th>
                <th className="py-2 font-medium">Leads won</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.adSourceId} className="border-border border-b last:border-0">
                  <td className="py-2 pr-3">{row.adHeadline}</td>
                  <td className="py-2 pr-3">{row.chatsStarted}</td>
                  <td className="py-2 pr-3">{row.replies}</td>
                  <td className="py-2">{row.leadsWon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
