'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalTabs, type PortalTabId } from '@/modules/social/config/portal-tabs';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';

type SettingsPayload = {
  config: { tabs?: Partial<Record<PortalTabId, boolean>>; adSpendVisible?: boolean };
  flags: {
    hasChannels: boolean;
    hasAds: boolean;
    hasShopify: boolean;
    hasLeadSources: boolean;
  };
  effective: Record<string, boolean>;
  adSpendVisible: boolean;
};

type Props = {
  clientId: string;
  active: boolean;
};

export function PortalTabsSettings({ clientId, active }: Props) {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<SettingsPayload>(`/api/social/clients/${clientId}/portal-tabs`);
      setSettings(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load portal tabs.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (!active) return;
    void load();
  }, [active, load]);

  async function setTab(id: PortalTabId, enabled: boolean) {
    setSaving(id);
    setError(null);
    try {
      const res = await apiFetch<SettingsPayload>(`/api/social/clients/${clientId}/portal-tabs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabs: { [id]: enabled } }),
      });
      setSettings(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update tab.');
    } finally {
      setSaving(null);
    }
  }

  async function setAdSpendVisible(visible: boolean) {
    setSaving('adSpend');
    setError(null);
    try {
      const res = await apiFetch<SettingsPayload>(`/api/social/clients/${clientId}/portal-tabs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adSpendVisible: visible }),
      });
      setSettings(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update ad spend setting.');
    } finally {
      setSaving(null);
    }
  }

  if (!active) return null;

  return (
    <div className="border-border space-y-3 border-t pt-4">
      <div>
        <p className="text-sm font-medium">Portal tabs</p>
        <p className="text-muted-foreground text-xs">
          Choose what this client sees. Ads / Sales / Leads follow connections unless you force them
          on or off.
        </p>
      </div>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      {loading || !settings ? (
        <p className="text-muted-foreground text-sm">Loading tabs…</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {portalTabs.map((tab) => {
            const checked = Boolean(settings.effective[tab.id]);
            return (
              <li key={tab.id} className="flex items-start justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">{tab.label}</p>
                  {tab.defaultHint ? (
                    <p className="text-muted-foreground text-xs">{tab.defaultHint}</p>
                  ) : null}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={saving === tab.id}
                    onChange={(event) => void setTab(tab.id, event.target.checked)}
                  />
                  Show
                </label>
              </li>
            );
          })}
          <li className="flex items-start justify-between gap-3 p-3">
            <div>
              <p className="text-sm font-medium">Show ad spend</p>
              <p className="text-muted-foreground text-xs">
                On by default. Hide amounts on the Ads tab for this client.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.adSpendVisible}
                disabled={saving === 'adSpend'}
                onChange={(event) => void setAdSpendVisible(event.target.checked)}
              />
              Visible
            </label>
          </li>
        </ul>
      )}
    </div>
  );
}
