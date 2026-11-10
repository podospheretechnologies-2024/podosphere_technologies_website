'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';

type GoalsPayload = {
  goals: {
    leadsPerMonth?: number | null;
    postsPerMonth?: number | null;
    adBudgetPerMonth?: number | null;
  };
};

type Props = {
  clientId: string;
  active: boolean;
};

export function PortalGoalsSettings({ clientId, active }: Props) {
  const [leads, setLeads] = useState('');
  const [posts, setPosts] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<GoalsPayload>(`/api/social/clients/${clientId}/portal-goals`);
      setLeads(res.goals.leadsPerMonth != null ? String(res.goals.leadsPerMonth) : '');
      setPosts(res.goals.postsPerMonth != null ? String(res.goals.postsPerMonth) : '');
      setBudget(res.goals.adBudgetPerMonth != null ? String(res.goals.adBudgetPerMonth) : '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load goals.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (!active) return;
    void load();
  }, [active, load]);

  function toNullableNumber(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/api/social/clients/${clientId}/portal-goals`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadsPerMonth: toNullableNumber(leads),
          postsPerMonth: toNullableNumber(posts),
          adBudgetPerMonth: toNullableNumber(budget),
        }),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save goals.');
    } finally {
      setSaving(false);
    }
  }

  if (!active) return null;

  return (
    <div className="border-border space-y-3 border-t pt-4">
      <div>
        <p className="text-sm font-medium">Goals &amp; budget</p>
        <p className="text-muted-foreground text-xs">
          Shown as progress on the client Overview. Leave blank to hide a goal.
        </p>
      </div>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      {saved ? <p className="text-sm text-green-700">Goals saved.</p> : null}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading goals…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-medium">
            Leads / month
            <Input
              className="mt-1"
              inputMode="numeric"
              value={leads}
              onChange={(event) => setLeads(event.target.value)}
              placeholder="500"
            />
          </label>
          <label className="block text-xs font-medium">
            Posts / month
            <Input
              className="mt-1"
              inputMode="numeric"
              value={posts}
              onChange={(event) => setPosts(event.target.value)}
              placeholder="20"
            />
          </label>
          <label className="block text-xs font-medium">
            Ad budget / month
            <Input
              className="mt-1"
              inputMode="decimal"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="25000"
            />
          </label>
        </div>
      )}
      <Button type="button" size="sm" disabled={saving || loading} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save goals'}
      </Button>
    </div>
  );
}
