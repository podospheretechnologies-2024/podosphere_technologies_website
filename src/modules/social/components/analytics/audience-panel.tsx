'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Sparkles, Trash } from 'lucide-react';
import dayjs from 'dayjs';
import { useClientScopeKey } from '../../hooks/use-client-scope';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface CompetitorTopPost {
  id: string;
  caption: string | null;
  likeCount: number;
  commentsCount: number;
  mediaType: string;
  permalink: string | null;
  timestamp: string;
  thumbnailUrl: string | null;
}

interface CompetitorSummary {
  summary: string;
  themes: string[];
  whatWorks: string[];
}

interface CompetitorRow {
  id: string;
  name: string;
  platform: string;
  externalId: string;
  snapshots: {
    id: string;
    followers: number;
    postsCount: number | null;
    engagementRate: number | null;
    date: string;
  }[];
  topPosts: CompetitorTopPost[];
}

export function AudiencePanel() {
  const scopeKey = useClientScopeKey();
  const { data, error, mutate } = useSWR(
    ['/api/social/analytics/audience', scopeKey],
    ([url]) => fetcher(url)
  );
  const [newCompetitor, setNewCompetitor] = useState({
    name: '',
    platform: 'instagram',
    externalId: '',
  });
  const [loading, setLoading] = useState(false);
  const [summaryById, setSummaryById] = useState<Record<string, CompetitorSummary>>({});
  const [summaryLoadingId, setSummaryLoadingId] = useState<string | null>(null);
  const [summaryErrorById, setSummaryErrorById] = useState<Record<string, string>>({});

  if (error) return <div className="text-red-500">Failed to load audience data</div>;
  if (!data) return <div className="text-gray-500 animate-pulse">Loading audience data...</div>;

  const {
    integrations,
    competitors,
    totalAudienceSize = 0,
    aiSummaryAvailable = false,
  } = data as {
    integrations: { id: string; name: string; providerIdentifier: string; followers?: number }[];
    competitors: CompetitorRow[];
    totalAudienceSize?: number;
    aiSummaryAvailable?: boolean;
  };

  const handleAddCompetitor = async () => {
    if (!newCompetitor.name || !newCompetitor.externalId) return;
    setLoading(true);
    await fetch('/api/social/analytics/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCompetitor),
    });
    setNewCompetitor({ name: '', platform: 'instagram', externalId: '' });
    mutate();
    setLoading(false);
  };

  const handleDeleteCompetitor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this competitor?')) return;
    setLoading(true);
    await fetch(`/api/social/analytics/competitors?id=${id}`, { method: 'DELETE' });
    mutate();
    setLoading(false);
  };

  const handleSummarise = async (id: string) => {
    setSummaryLoadingId(id);
    setSummaryErrorById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await fetch(`/api/social/analytics/competitors/${id}/summary`, {
        method: 'POST',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSummaryErrorById((prev) => ({
          ...prev,
          [id]: body.error || 'Could not generate summary',
        }));
        return;
      }
      setSummaryById((prev) => ({
        ...prev,
        [id]: {
          summary: body.summary,
          themes: body.themes ?? [],
          whatWorks: body.whatWorks ?? [],
        },
      }));
    } catch {
      setSummaryErrorById((prev) => ({
        ...prev,
        [id]: 'Could not generate summary',
      }));
    } finally {
      setSummaryLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">Your Audience Growth</h2>
        <div className="flex gap-12">
          <div>
            <div className="text-sm text-gray-500 font-medium">Total Audience Size</div>
            <div className="text-4xl font-extrabold mt-1">{totalAudienceSize.toLocaleString()}</div>
          </div>
        </div>

        {integrations.length > 0 && (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-sm font-semibold mb-4 text-gray-500 uppercase">Followers by Channel</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {integrations.map((channel) => {
                const count = channel.followers ?? 0;
                return (
                  <div key={channel.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="font-semibold text-gray-900 line-clamp-1">{channel.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{channel.providerIdentifier}</div>
                    <div className="text-2xl font-bold mt-2">{Number(count).toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">Competitor Tracking</h2>
            <p className="text-gray-500 text-sm mt-1">
              Track followers and their top posts this month via Meta Business Discovery.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8 flex gap-4 items-end">
          <label className="flex-1 space-y-1">
            <span className="text-sm font-medium text-gray-700">Competitor Name</span>
            <Input
              value={newCompetitor.name}
              onChange={(e) => setNewCompetitor({ ...newCompetitor, name: e.target.value })}
              placeholder="e.g. Nike"
            />
          </label>
          <label className="flex-1 space-y-1">
            <span className="text-sm font-medium text-gray-700">Instagram Username</span>
            <Input
              value={newCompetitor.externalId}
              onChange={(e) => setNewCompetitor({ ...newCompetitor, externalId: e.target.value })}
              placeholder="e.g. nike"
            />
          </label>
          <Button
            onClick={handleAddCompetitor}
            disabled={loading || !newCompetitor.name || !newCompetitor.externalId}
          >
            Add Competitor
          </Button>
        </div>

        {competitors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No competitors added yet. Add one above to start tracking!
          </div>
        ) : (
          <div className="space-y-6">
            {competitors.map((comp) => {
              const latestSnapshot = comp.snapshots[comp.snapshots.length - 1];
              const summary = summaryById[comp.id];
              const summaryError = summaryErrorById[comp.id];
              return (
                <div key={comp.id} className="border border-gray-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{comp.name}</h3>
                      <div className="text-sm text-gray-500">
                        @{comp.externalId} • {comp.platform}
                      </div>
                    </div>

                    <div className="flex items-center gap-8 text-right">
                      {latestSnapshot ? (
                        <>
                          <div>
                            <div className="text-xs text-gray-500 font-medium uppercase">Followers</div>
                            <div className="font-bold text-xl tabular-nums">
                              {latestSnapshot.followers.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 font-medium uppercase">Posts</div>
                            <div className="font-bold text-xl tabular-nums">
                              {latestSnapshot.postsCount?.toLocaleString() || '-'}
                            </div>
                          </div>
                          {latestSnapshot.engagementRate != null && (
                            <div>
                              <div className="text-xs text-gray-500 font-medium uppercase">Eng. rate</div>
                              <div className="font-bold text-xl tabular-nums">
                                {latestSnapshot.engagementRate.toFixed(2)}%
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-gray-400 italic">Syncing tonight...</div>
                      )}
                      {aiSummaryAvailable && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSummarise(comp.id)}
                          disabled={summaryLoadingId === comp.id || loading || !comp.topPosts?.length}
                          className="gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {summaryLoadingId === comp.id ? 'Summarising…' : 'AI summary'}
                        </Button>
                      )}
                      <button
                        onClick={() => handleDeleteCompetitor(comp.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow"
                        disabled={loading}
                        aria-label={`Delete ${comp.name}`}
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {comp.topPosts?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                        Top posts this month
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {comp.topPosts.map((post) => (
                          <a
                            key={post.id}
                            href={post.permalink || undefined}
                            target={post.permalink ? '_blank' : undefined}
                            rel={post.permalink ? 'noreferrer' : undefined}
                            className={`block rounded-lg border border-gray-100 bg-gray-50 p-3 text-left ${
                              post.permalink ? 'hover:border-gray-300 transition' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] font-semibold uppercase text-gray-400">
                                {post.mediaType.replace('_', ' ')}
                              </span>
                              {post.timestamp && (
                                <span className="text-[10px] text-gray-400">
                                  {dayjs(post.timestamp).format('D MMM')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-800 line-clamp-3 min-h-[3.75rem]">
                              {post.caption?.trim() || 'No caption'}
                            </p>
                            <div className="mt-2 flex gap-3 text-xs text-gray-500 tabular-nums">
                              <span>{post.likeCount.toLocaleString()} likes</span>
                              <span>{post.commentsCount.toLocaleString()} comments</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {latestSnapshot && (!comp.topPosts || comp.topPosts.length === 0) && (
                    <p className="text-sm text-gray-400">
                      No posts from this month in the latest sync yet.
                    </p>
                  )}

                  {summaryError && <p className="text-sm text-red-600">{summaryError}</p>}

                  {summary && (
                    <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-900">What is working</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{summary.summary}</p>
                      {summary.themes.length > 0 && (
                        <div>
                          <div className="text-xs font-medium uppercase text-gray-500 mb-1">Themes</div>
                          <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                            {summary.themes.map((theme) => (
                              <li key={theme}>{theme}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {summary.whatWorks.length > 0 && (
                        <div>
                          <div className="text-xs font-medium uppercase text-gray-500 mb-1">
                            Patterns
                          </div>
                          <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                            {summary.whatWorks.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
