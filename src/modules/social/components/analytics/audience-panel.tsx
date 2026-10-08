'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Trash } from 'lucide-react';
import dayjs from 'dayjs';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function AudiencePanel() {
  const { data, error, mutate } = useSWR('/api/social/analytics/audience', fetcher);
  const [newCompetitor, setNewCompetitor] = useState({ name: '', platform: 'instagram', externalId: '' });
  const [loading, setLoading] = useState(false);

  if (error) return <div className="text-red-500">Failed to load audience data</div>;
  if (!data) return <div className="text-gray-500 animate-pulse">Loading audience data...</div>;

  const { integrations, dailyInsights, competitors } = data;

  // Calculate total followers today
  const latestFollowers = dailyInsights.reduce((acc: any, curr: any) => {
    acc[curr.integrationId] = curr.value; // Store the latest value per integration
    return acc;
  }, {});
  const totalAudienceSize = Object.values(latestFollowers).reduce((a: any, b: any) => a + Number(b), 0) as number;

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

  return (
    <div className="space-y-6">
      
      {/* 1. Audience Summary */}
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
              {integrations.map((channel: any) => {
                const count = latestFollowers[channel.id] || 0;
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

      {/* 2. Competitors */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">Competitor Tracking</h2>
            <p className="text-gray-500 text-sm mt-1">Track public followers for competitors daily via Meta API.</p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8 flex gap-4 items-end">
          <label className="flex-1 space-y-1">
            <span className="text-sm font-medium text-gray-700">Competitor Name</span>
            <Input 
              value={newCompetitor.name} 
              onChange={e => setNewCompetitor({...newCompetitor, name: e.target.value})}
              placeholder="e.g. Nike" 
            />
          </label>
          <label className="flex-1 space-y-1">
            <span className="text-sm font-medium text-gray-700">Instagram Username</span>
            <Input 
              value={newCompetitor.externalId} 
              onChange={e => setNewCompetitor({...newCompetitor, externalId: e.target.value})}
              placeholder="e.g. nike" 
            />
          </label>
          <Button onClick={handleAddCompetitor} disabled={loading || !newCompetitor.name || !newCompetitor.externalId}>
            Add Competitor
          </Button>
        </div>

        {competitors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No competitors added yet. Add one above to start tracking!
          </div>
        ) : (
          <div className="space-y-4">
            {competitors.map((comp: any) => {
              const latestSnapshot = comp.snapshots[comp.snapshots.length - 1];
              return (
                <div key={comp.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{comp.name}</h3>
                    <div className="text-sm text-gray-500">@{comp.externalId} • {comp.platform}</div>
                  </div>
                  
                  <div className="flex items-center gap-12 text-right">
                    {latestSnapshot ? (
                      <>
                        <div>
                          <div className="text-xs text-gray-500 font-medium uppercase">Followers</div>
                          <div className="font-bold text-xl tabular-nums">{latestSnapshot.followers.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 font-medium uppercase">Posts</div>
                          <div className="font-bold text-xl tabular-nums">{latestSnapshot.postsCount?.toLocaleString() || '-'}</div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-400 italic">Syncing tonight...</div>
                    )}
                    <button 
                      onClick={() => handleDeleteCompetitor(comp.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow"
                      disabled={loading}
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
