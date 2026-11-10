'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/shared/lib/fetcher';

type RequestRow = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  status: string;
  reply: string | null;
  createdAt: string;
};

const STATUSES = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
  { id: 'declined', label: 'Declined' },
] as const;

type Props = {
  clientId: string;
  active: boolean;
};

export function PortalRequestsAgency({ clientId, active }: Props) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ requests: RequestRow[] }>(
        `/api/social/clients/${clientId}/portal-requests`
      );
      setRequests(res.requests);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load requests.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (!active) return;
    void load();
  }, [active, load]);

  async function setStatus(requestId: string, status: string) {
    setBusyId(requestId);
    setError(null);
    try {
      const res = await apiFetch<{ request: RequestRow }>(
        `/api/social/clients/${clientId}/portal-requests?requestId=${encodeURIComponent(requestId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );
      setRequests((rows) => rows.map((row) => (row.id === requestId ? res.request : row)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update request.');
    } finally {
      setBusyId(null);
    }
  }

  if (!active) return null;

  return (
    <div className="border-border space-y-3 border-t pt-4">
      <div>
        <p className="text-sm font-medium">Client requests</p>
        <p className="text-muted-foreground text-xs">
          Update status when you pick up or finish a portal request.
        </p>
      </div>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading requests…</p>
      ) : requests.length === 0 ? (
        <p className="text-muted-foreground text-sm">No requests from this client yet.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {requests.map((request) => (
            <li key={request.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{request.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {request.type} · {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                  {request.detail ? (
                    <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">
                      {request.detail}
                    </p>
                  ) : null}
                </div>
                <select
                  className="border-border rounded-md border px-2 py-1 text-xs"
                  value={request.status}
                  disabled={busyId === request.id}
                  onChange={(event) => void setStatus(request.id, event.target.value)}
                >
                  {STATUSES.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
