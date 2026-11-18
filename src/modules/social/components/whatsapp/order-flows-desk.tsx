'use client';

import { useState } from 'react';
import { Card } from '@/shared/components/ui/card';
import type { OrderFlowKey } from '../../config/order-flows';
import { useOrderFlows } from '../../hooks/use-order-flows';
import { useWhatsApp } from '../../hooks/use-whatsapp';
import { OrderFlowActivity } from './order-flow-activity';
import { OrderFlowEditor } from './order-flow-editor';
import { OrderFlowList } from './order-flow-list';
import { OrderFlowResults } from './order-flow-results';
import { OrderFlowStarterTemplates } from './order-flow-starter-templates';

type DeskTab = 'flows' | 'activity' | 'results' | 'templates';

const TABS: { id: DeskTab; label: string }[] = [
  { id: 'flows', label: 'Flows' },
  { id: 'activity', label: 'Activity' },
  { id: 'results', label: 'Results' },
  { id: 'templates', label: 'Starter templates' },
];

export function OrderFlowsDesk() {
  const { data, error, isLoading, mutate } = useOrderFlows();
  const whatsapp = useWhatsApp();
  const [tab, setTab] = useState<DeskTab>('flows');
  const [editingKey, setEditingKey] = useState<OrderFlowKey | null>(null);

  const numberConnected = Boolean(whatsapp.data?.configured && whatsapp.data.number);
  const phoneDisplay = whatsapp.data?.number?.displayPhoneNumber ?? null;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            WhatsApp order flows
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Order updates and cart recovery messages for the connected Shopify store.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setEditingKey(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === item.id && !editingKey
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {editingKey ? (
        <OrderFlowEditor
          flowKey={editingKey}
          storeName={data?.store.shopName ?? data?.store.shopDomain}
          onCancel={() => setEditingKey(null)}
          onSaved={async () => {
            await mutate();
            setEditingKey(null);
            setTab('flows');
          }}
        />
      ) : tab === 'templates' ? (
        <OrderFlowStarterTemplates />
      ) : error && !data ? (
        <p className="text-danger text-sm">
          {error instanceof Error ? error.message : 'Could not load order flows'}
        </p>
      ) : isLoading && !data ? (
        <p className="text-muted-foreground text-sm">Loading order flows…</p>
      ) : tab === 'flows' && data ? (
        <OrderFlowList
          data={data}
          numberConnected={numberConnected}
          phoneDisplay={phoneDisplay}
          onEdit={(key) => setEditingKey(key)}
          onMutate={() => mutate()}
        />
      ) : tab === 'activity' ? (
        <OrderFlowActivity />
      ) : tab === 'results' ? (
        <OrderFlowResults />
      ) : (
        <p className="text-muted-foreground text-sm">No order flow data yet.</p>
      )}
    </Card>
  );
}
