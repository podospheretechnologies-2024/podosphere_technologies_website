import 'server-only';
import { getServerEnv } from '@/shared/lib/env';
import { HttpError } from '@/shared/server/http-error';
import { ADS_LEAD_ACTION_TYPES, type AdsDatePreset } from '../../config/ads';
import type {
  AdAccountItem,
  AdsCampaignItem,
  AdsDailyPoint,
  AdsOverview,
  AdsTotals,
} from '../../types/ads';
import {
  GraphApiError,
  graphGet,
  type GraphConfig,
  type GraphList,
} from '../integrations/providers/meta/graph-client';

// Read-only: nothing here pauses, edits or creates ads. See PODO_SOCIAL.md section 8 (safety rules).

interface GraphAction {
  action_type: string;
  value: string;
}

interface GraphInsight {
  campaign_id?: string;
  campaign_name?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: GraphAction[];
}

interface GraphAdAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
  amount_spent?: string;
}

interface GraphCampaign {
  id: string;
  name: string;
  effective_status: string;
  objective: string;
}

function credentials(): { graph: GraphConfig; token: string } {
  const env = getServerEnv();
  if (!env.META_SYSTEM_USER_TOKEN) {
    throw new HttpError(503, 'Ads are not configured. Set META_SYSTEM_USER_TOKEN in .env (see PODO_SOCIAL.md).');
  }
  return {
    graph: { version: env.META_GRAPH_VERSION, appSecret: env.META_APP_SECRET || undefined },
    token: env.META_SYSTEM_USER_TOKEN,
  };
}

async function get<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const { graph, token } = credentials();
  try {
    return await graphGet<T>(graph, path, token, params);
  } catch (error) {
    if (error instanceof GraphApiError) {
      if (error.isAuthError) {
        throw new HttpError(503, 'The Meta system user token is expired or revoked. Generate a new one.');
      }
      if (error.code === 10 || error.code === 200 || error.code === 294) {
        throw new HttpError(403, 'The system user has no access to this ad account (needs ads_read).');
      }
      if (error.code === 17 || error.code === 80004) {
        throw new HttpError(429, 'Meta rate limit reached for this ad account. Try again in a few minutes.');
      }
      throw new HttpError(502, `Meta: ${error.message}`);
    }
    throw error;
  }
}

const num = (value: string | undefined) => (value ? Number(value) : 0);

function leadsOf(actions: GraphAction[] | undefined): number {
  if (!actions) {
    return 0;
  }
  // Meta reports the same lead under several action types; take the first one that exists.
  for (const type of ADS_LEAD_ACTION_TYPES) {
    const match = actions.find((action) => action.action_type === type);
    if (match) {
      return num(match.value);
    }
  }
  return 0;
}

function toTotals(row: GraphInsight | undefined): AdsTotals {
  const spend = num(row?.spend);
  const leads = leadsOf(row?.actions);
  return {
    spend,
    impressions: num(row?.impressions),
    reach: num(row?.reach),
    clicks: num(row?.clicks),
    ctr: num(row?.ctr),
    cpc: num(row?.cpc),
    leads,
    costPerLead: leads ? spend / leads : null,
  };
}

function toAccount(account: GraphAdAccount): AdAccountItem {
  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    status: account.account_status,
    // amount_spent is in the account's minor unit (paise for INR).
    amountSpent: num(account.amount_spent) / 100,
  };
}

export const adsService = {
  isConfigured(): boolean {
    return Boolean(getServerEnv().META_SYSTEM_USER_TOKEN);
  },

  /** Ad accounts the system user was given access to in Business Manager. */
  async listAccounts(): Promise<AdAccountItem[]> {
    const result = await get<GraphList<GraphAdAccount>>('me/adaccounts', {
      fields: 'name,currency,account_status,amount_spent',
      limit: 200,
    });
    return result.data.map(toAccount).sort((a, b) => a.name.localeCompare(b.name));
  },

  async overview(accountId: string, datePreset: AdsDatePreset): Promise<AdsOverview> {
    const accounts = await this.listAccounts();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) {
      throw new HttpError(404, 'Ad account not found or not shared with the system user');
    }

    const [totals, daily, campaignInsights, campaigns] = await Promise.all([
      get<GraphList<GraphInsight>>(`${accountId}/insights`, {
        fields: 'spend,impressions,reach,clicks,ctr,cpc,actions',
        date_preset: datePreset,
      }),
      get<GraphList<GraphInsight>>(`${accountId}/insights`, {
        fields: 'spend,clicks',
        date_preset: datePreset,
        time_increment: 1,
        limit: 100,
      }),
      get<GraphList<GraphInsight>>(`${accountId}/insights`, {
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,ctr,actions',
        level: 'campaign',
        date_preset: datePreset,
        limit: 200,
      }),
      get<GraphList<GraphCampaign>>(`${accountId}/campaigns`, {
        fields: 'name,effective_status,objective',
        limit: 200,
      }),
    ]);

    const insightByCampaign = new Map(campaignInsights.data.map((row) => [row.campaign_id, row]));

    const campaignItems: AdsCampaignItem[] = campaigns.data.map((campaign) => {
      const stats = toTotals(insightByCampaign.get(campaign.id));
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.effective_status,
        objective: campaign.objective,
        spend: stats.spend,
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: stats.ctr,
        leads: stats.leads,
        costPerLead: stats.costPerLead,
      };
    });

    // Live campaigns first, then by spend in the period.
    campaignItems.sort(
      (a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || b.spend - a.spend
    );

    const dailyPoints: AdsDailyPoint[] = daily.data.map((row) => ({
      date: row.date_start ?? '',
      spend: num(row.spend),
      clicks: num(row.clicks),
    }));

    return {
      account,
      datePreset,
      totals: toTotals(totals.data[0]),
      daily: dailyPoints,
      campaigns: campaignItems,
    };
  },
};
