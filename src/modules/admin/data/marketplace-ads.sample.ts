export const MARKETPLACES = ['meta', 'google', 'blinkit', 'meesho', 'flipkart', 'amazon'] as const;
export type MarketplaceId = (typeof MARKETPLACES)[number];
type SellerMarketplaceId = Exclude<MarketplaceId, 'meta'>;

export const MARKETPLACE_CLIENT_SLOTS = 3;

export type CampaignStatus = 'LIVE' | 'PAUSED' | 'LEARNING';

export type MarketplaceCampaign = {
  id: string;
  name: string;
  type: string;
  status: CampaignStatus;
  duration: string;
  budgetLabel: string;
  spend: number;
  impressions: number;
  clicks: number;
  orders: number;
  revenue: number;
  roas: number;
  action?: string;
};

export type MarketplaceSnapshot = {
  wallet: number;
  kpis: {
    spend: number;
    revenue: number;
    roas: number;
    impressions: number;
    clicks: number;
    orders: number;
  };
  extras: { label: string; value: string }[];
  trend: number[];
  campaigns: MarketplaceCampaign[];
};

export type MarketplaceClientOption = {
  id: string;
  name: string;
  organizationName: string;
  isDemo: boolean;
};

export const PREFERRED_SAMPLE_CLIENTS = [
  { name: 'Dastkar', match: /dastkar/i },
  { name: 'Sitara Beauty', match: /sitara/i },
  { name: 'Podosphere', match: /podosphere/i },
] as const;

export const MARKETPLACE_META: Record<MarketplaceId, { label: string; pill: string; accent: string }> = {
  meta: {
    label: 'Meta Ads',
    pill: 'bg-blue-100 text-blue-800 border-blue-200',
    accent: '#1877F2',
  },
  google: {
    label: 'Google Ads',
    pill: 'bg-sky-100 text-sky-800 border-sky-200',
    accent: '#1A73E8',
  },
  blinkit: {
    label: 'Blinkit',
    pill: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    accent: '#F8C41A',
  },
  meesho: {
    label: 'Meesho',
    pill: 'bg-pink-100 text-pink-800 border-pink-200',
    accent: '#F43397',
  },
  flipkart: {
    label: 'Flipkart',
    pill: 'bg-blue-100 text-blue-800 border-blue-200',
    accent: '#2874F0',
  },
  amazon: {
    label: 'Amazon',
    pill: 'bg-orange-100 text-orange-800 border-orange-200',
    accent: '#FF9900',
  },
};

/** Three client slots × Google Ads + four marketplaces. Mapped onto real SocialCustomer names at render. */
export const MARKETPLACE_SAMPLE: Array<Record<SellerMarketplaceId, MarketplaceSnapshot>> = [
  {
    blinkit: {
      wallet: 779.98,
      kpis: { spend: 121523, revenue: 0, roas: 0, impressions: 156295, clicks: 561, orders: 0 },
      extras: [
        { label: 'ATC', value: '0' },
        { label: 'Active', value: '16 / 45' },
        { label: 'QC actions', value: '0' },
      ],
      trend: [8, 12, 18, 22, 28, 35, 48, 80, 52, 41, 38],
      campaigns: [
        {
          id: 'b1-1',
          name: 'Atta & staples · Delhi booster',
          type: 'Product Booster',
          status: 'LIVE',
          duration: '23 Sep \'26 – 30 Oct \'26',
          budgetLabel: '₹5,000 total',
          spend: 741,
          impressions: 561,
          clicks: 18,
          orders: 0,
          revenue: 0,
          roas: 0,
        },
        {
          id: 'b1-2',
          name: 'Oil & ghee · NCR booster',
          type: 'Product Booster',
          status: 'LIVE',
          duration: '23 Sep \'26 – 30 Oct \'26',
          budgetLabel: '₹8,000 total',
          spend: 2336,
          impressions: 1931,
          clicks: 64,
          orders: 8,
          revenue: 6100,
          roas: 2.61,
        },
        {
          id: 'b1-3',
          name: 'Ready meals · Recommendation ads',
          type: 'Recommendation Ads',
          status: 'LIVE',
          duration: '07 Oct \'26 – No end date',
          budgetLabel: '₹12,000 total',
          spend: 3486,
          impressions: 9496,
          clicks: 112,
          orders: 6,
          revenue: 1394,
          roas: 0.4,
        },
      ],
    },
    meesho: {
      wallet: 0,
      kpis: { spend: 596.49, revenue: 267, roas: 0.45, impressions: 151417, clicks: 1496, orders: 1 },
      extras: [
        { label: 'Live', value: '4' },
        { label: 'Avg ROI', value: '0.45' },
        { label: 'Sale opted-in', value: '2' },
      ],
      trend: [4, 6, 9, 11, 14, 18, 16, 22, 19, 21, 24],
      campaigns: [
        {
          id: 'm1-1',
          name: '4987165-10/5/2026',
          type: '1 Catalog',
          status: 'LIVE',
          duration: '05 Oct 2026 – No end date',
          budgetLabel: '₹330 daily',
          spend: 578.92,
          impressions: 126212,
          clicks: 1405,
          orders: 1,
          revenue: 267,
          roas: 0.46,
          action: 'Low orders — reduce ROI target',
        },
        {
          id: 'm1-2',
          name: '4987165-10/5/2026 Auto',
          type: 'Auto Catalogs',
          status: 'LEARNING',
          duration: '05 Oct 2026 – Till budget lasts',
          budgetLabel: '₹600 total',
          spend: 0,
          impressions: 0,
          clicks: 0,
          orders: 0,
          revenue: 0,
          roas: 0,
        },
        {
          id: 'm1-3',
          name: 'New_Catalog_Tester_28 Sep 2026',
          type: '1 Catalog',
          status: 'LIVE',
          duration: '28 Sep 2026 – No end date',
          budgetLabel: '₹100 daily',
          spend: 13.97,
          impressions: 21474,
          clicks: 79,
          orders: 0,
          revenue: 0,
          roas: 0,
        },
      ],
    },
    flipkart: {
      wallet: 1302.87,
      kpis: { spend: 3400, revenue: 4730, roas: 1.39, impressions: 45000, clicks: 406, orders: 4 },
      extras: [
        { label: 'CTR', value: '0.90%' },
        { label: 'CVR', value: '0.99%' },
        { label: 'Units sold', value: '4' },
      ],
      trend: [12, 14, 13, 18, 22, 20, 24, 28, 26, 30, 27],
      campaigns: [
        {
          id: 'f1-1',
          name: 'Staples PLA · keywords',
          type: 'PLA',
          status: 'LIVE',
          duration: '13 Oct \'26 – Till budget ends',
          budgetLabel: '₹300 daily',
          spend: 1991,
          impressions: 13807,
          clicks: 140,
          orders: 2,
          revenue: 2480,
          roas: 1.25,
        },
        {
          id: 'f1-2',
          name: 'HMB Advertisement Campaign',
          type: 'PLA',
          status: 'LIVE',
          duration: '17 Sep \'25 – Till budget ends',
          budgetLabel: '₹300 daily',
          spend: 114,
          impressions: 1678,
          clicks: 19,
          orders: 0,
          revenue: 0,
          roas: 0,
        },
        {
          id: 'f1-3',
          name: 'PLA_Campaign-2026-01-31',
          type: 'PLA',
          status: 'PAUSED',
          duration: '31 Jan \'26 – Till budget ends',
          budgetLabel: '₹1,000 total',
          spend: 10,
          impressions: 3834,
          clicks: 14,
          orders: 0,
          revenue: 0,
          roas: 0,
        },
      ],
    },
    amazon: {
      wallet: 4200,
      kpis: { spend: 32485.19, revenue: 38342.91, roas: 1.18, impressions: 431241, clicks: 2143, orders: 110 },
      extras: [
        { label: 'DPV', value: '611' },
        { label: 'NTB purchases', value: '0' },
        { label: 'Branded searches', value: '3' },
      ],
      trend: [20, 24, 22, 30, 28, 35, 40, 38, 44, 42, 48],
      campaigns: [
        {
          id: 'a1-1',
          name: 'Thise x Auto - NVeg',
          type: 'Sponsored Products · Automatic',
          status: 'PAUSED',
          duration: '29 May 2026 – No end date',
          budgetLabel: '₹40 / day',
          spend: 8120,
          impressions: 94000,
          clicks: 410,
          orders: 22,
          revenue: 9100,
          roas: 1.12,
        },
        {
          id: 'a1-2',
          name: 'Thise x Auto - Veg',
          type: 'Sponsored Products · Automatic',
          status: 'PAUSED',
          duration: '29 May 2026 – No end date',
          budgetLabel: '₹50 / day',
          spend: 6400,
          impressions: 71000,
          clicks: 280,
          orders: 18,
          revenue: 7200,
          roas: 1.13,
        },
        {
          id: 'a1-3',
          name: 'ANA_SPN_SG_Adaptive Campaign',
          type: 'Sponsored Products · Manual',
          status: 'LIVE',
          duration: '8 Jul 2026 – No end date',
          budgetLabel: '₹15 / day',
          spend: 17965,
          impressions: 266241,
          clicks: 1453,
          orders: 70,
          revenue: 22042,
          roas: 1.23,
        },
      ],
    },
    google: {
      wallet: 8500,
      kpis: { spend: 28400, revenue: 41220, roas: 1.45, impressions: 312000, clicks: 4200, orders: 96 },
      extras: [
        { label: 'CTR', value: '1.35%' },
        { label: 'Avg CPC', value: '₹6.76' },
        { label: 'Conversions', value: '96' },
      ],
      trend: [16, 18, 22, 20, 26, 30, 28, 34, 40, 38, 42],
      campaigns: [
        {
          id: 'g1-1',
          name: 'Staples Search · brand + generics',
          type: 'Search',
          status: 'LIVE',
          duration: '01 Sep 2026 – No end date',
          budgetLabel: '₹1,200 / day',
          spend: 18600,
          impressions: 142000,
          clicks: 2480,
          orders: 62,
          revenue: 26800,
          roas: 1.44,
        },
        {
          id: 'g1-2',
          name: 'Grocery Shopping · PLA',
          type: 'Shopping',
          status: 'LIVE',
          duration: '12 Sep 2026 – No end date',
          budgetLabel: '₹800 / day',
          spend: 7200,
          impressions: 98000,
          clicks: 1120,
          orders: 28,
          revenue: 10420,
          roas: 1.45,
        },
        {
          id: 'g1-3',
          name: 'Ready meals · PMax',
          type: 'Performance Max',
          status: 'LEARNING',
          duration: '05 Oct 2026 – No end date',
          budgetLabel: '₹400 / day',
          spend: 2600,
          impressions: 72000,
          clicks: 600,
          orders: 6,
          revenue: 4000,
          roas: 1.54,
        },
      ],
    },
  },
  {
    blinkit: {
      wallet: 2140,
      kpis: { spend: 18640, revenue: 41220, roas: 2.21, impressions: 88210, clicks: 1940, orders: 126 },
      extras: [
        { label: 'ATC', value: '214' },
        { label: 'Active', value: '8 / 12' },
        { label: 'Rank drop', value: '0' },
      ],
      trend: [10, 16, 18, 24, 30, 28, 36, 44, 40, 48, 52],
      campaigns: [
        {
          id: 'b2-1',
          name: 'Starogaze Fitblend Blender 500W · Delhi',
          type: 'Product Booster',
          status: 'LIVE',
          duration: '23 Sep \'26 – 30 Oct \'26',
          budgetLabel: '₹4,000 total',
          spend: 2336,
          impressions: 1931,
          clicks: 88,
          orders: 8,
          revenue: 6100,
          roas: 2.61,
        },
        {
          id: 'b2-2',
          name: 'Starogaze Fitblend · Recommendation',
          type: 'Recommendation Ads',
          status: 'LIVE',
          duration: '07 Oct \'26 – No end date',
          budgetLabel: '₹9,000 total',
          spend: 3486,
          impressions: 9496,
          clicks: 210,
          orders: 6,
          revenue: 1394,
          roas: 0.4,
        },
        {
          id: 'b2-3',
          name: 'Magnet Electric Chopper · Keywords',
          type: 'Product Booster',
          status: 'LIVE',
          duration: '07 Oct \'26 – No end date',
          budgetLabel: '₹15,000 total',
          spend: 9534,
          impressions: 6054,
          clicks: 340,
          orders: 10,
          revenue: 2574,
          roas: 0.27,
        },
      ],
    },
    meesho: {
      wallet: 0,
      kpis: { spend: 1820, revenue: 3940, roas: 2.16, impressions: 62400, clicks: 880, orders: 14 },
      extras: [
        { label: 'Live', value: '3' },
        { label: 'Avg ROI', value: '2.16' },
        { label: 'Paused', value: '1' },
      ],
      trend: [6, 8, 7, 12, 14, 18, 16, 20, 24, 22, 26],
      campaigns: [
        {
          id: 'm2-1',
          name: 'Kitchen catalog · festive',
          type: '1 Catalog',
          status: 'LIVE',
          duration: '01 Oct 2026 – No end date',
          budgetLabel: '₹250 daily',
          spend: 1420,
          impressions: 48100,
          clicks: 640,
          orders: 11,
          revenue: 3180,
          roas: 2.24,
        },
        {
          id: 'm2-2',
          name: 'Chopper auto catalogs',
          type: 'Auto Catalogs',
          status: 'LEARNING',
          duration: '12 Oct 2026 – Till budget lasts',
          budgetLabel: '₹400 total',
          spend: 90,
          impressions: 2100,
          clicks: 28,
          orders: 0,
          revenue: 0,
          roas: 0,
        },
        {
          id: 'm2-3',
          name: 'Blender listing ads',
          type: '1 Catalog',
          status: 'PAUSED',
          duration: '20 Sep 2026 – No end date',
          budgetLabel: '₹150 daily',
          spend: 310,
          impressions: 12200,
          clicks: 212,
          orders: 3,
          revenue: 760,
          roas: 2.45,
        },
      ],
    },
    flipkart: {
      wallet: 860,
      kpis: { spend: 5120, revenue: 9800, roas: 1.91, impressions: 61000, clicks: 720, orders: 18 },
      extras: [
        { label: 'CTR', value: '1.18%' },
        { label: 'CVR', value: '2.50%' },
        { label: 'Units sold', value: '18' },
      ],
      trend: [9, 11, 14, 13, 18, 21, 19, 24, 26, 23, 28],
      campaigns: [
        {
          id: 'f2-1',
          name: 'Fitblend PLA · bestsellers',
          type: 'PLA',
          status: 'LIVE',
          duration: '04 Sep \'26 – Till budget ends',
          budgetLabel: '₹1,000 daily',
          spend: 3120,
          impressions: 28000,
          clicks: 410,
          orders: 12,
          revenue: 6400,
          roas: 2.05,
        },
        {
          id: 'f2-2',
          name: 'Chopper PLA · keywords',
          type: 'PLA',
          status: 'LIVE',
          duration: '12 Dec \'25 – Till budget ends',
          budgetLabel: '₹300 daily',
          spend: 2000,
          impressions: 33000,
          clicks: 310,
          orders: 6,
          revenue: 3400,
          roas: 1.7,
        },
      ],
    },
    amazon: {
      wallet: 1850,
      kpis: { spend: 9400, revenue: 15820, roas: 1.68, impressions: 122400, clicks: 980, orders: 44 },
      extras: [
        { label: 'DPV', value: '1,240' },
        { label: 'NTB purchases', value: '9' },
        { label: 'Branded searches', value: '18' },
      ],
      trend: [14, 16, 18, 22, 20, 26, 30, 28, 34, 36, 32],
      campaigns: [
        {
          id: 'a2-1',
          name: 'Blender SP · exact keywords',
          type: 'Sponsored Products · Manual',
          status: 'LIVE',
          duration: '01 Sep 2026 – No end date',
          budgetLabel: '₹120 / day',
          spend: 6400,
          impressions: 88000,
          clicks: 640,
          orders: 30,
          revenue: 11200,
          roas: 1.75,
        },
        {
          id: 'a2-2',
          name: 'Chopper SP · auto',
          type: 'Sponsored Products · Automatic',
          status: 'LIVE',
          duration: '15 Sep 2026 – No end date',
          budgetLabel: '₹80 / day',
          spend: 3000,
          impressions: 34400,
          clicks: 340,
          orders: 14,
          revenue: 4620,
          roas: 1.54,
        },
      ],
    },
    google: {
      wallet: 4200,
      kpis: { spend: 15400, revenue: 28600, roas: 1.86, impressions: 188000, clicks: 2650, orders: 74 },
      extras: [
        { label: 'CTR', value: '1.41%' },
        { label: 'Avg CPC', value: '₹5.81' },
        { label: 'Conversions', value: '74' },
      ],
      trend: [12, 14, 18, 16, 22, 24, 28, 26, 32, 30, 36],
      campaigns: [
        {
          id: 'g2-1',
          name: 'Fitblend Search · exact',
          type: 'Search',
          status: 'LIVE',
          duration: '01 Sep 2026 – No end date',
          budgetLabel: '₹700 / day',
          spend: 9800,
          impressions: 64000,
          clicks: 1540,
          orders: 48,
          revenue: 18600,
          roas: 1.90,
        },
        {
          id: 'g2-2',
          name: 'Kitchen appliances · Shopping',
          type: 'Shopping',
          status: 'LIVE',
          duration: '18 Sep 2026 – No end date',
          budgetLabel: '₹500 / day',
          spend: 5600,
          impressions: 124000,
          clicks: 1110,
          orders: 26,
          revenue: 10000,
          roas: 1.79,
        },
      ],
    },
  },
  {
    blinkit: {
      wallet: 540,
      kpis: { spend: 4280, revenue: 9120, roas: 2.13, impressions: 33400, clicks: 510, orders: 36 },
      extras: [
        { label: 'ATC', value: '72' },
        { label: 'Active', value: '4 / 6' },
        { label: 'Under serving', value: '1' },
      ],
      trend: [5, 8, 7, 12, 16, 14, 18, 22, 20, 24, 26],
      campaigns: [
        {
          id: 'b3-1',
          name: 'Whey isolate · 10-min delivery',
          type: 'Product Booster',
          status: 'LIVE',
          duration: '01 Oct \'26 – 31 Oct \'26',
          budgetLabel: '₹3,000 total',
          spend: 2680,
          impressions: 21000,
          clicks: 320,
          orders: 24,
          revenue: 6400,
          roas: 2.39,
        },
        {
          id: 'b3-2',
          name: 'Creatine · Recommendation ads',
          type: 'Recommendation Ads',
          status: 'LEARNING',
          duration: '14 Oct \'26 – No end date',
          budgetLabel: '₹2,000 total',
          spend: 1600,
          impressions: 12400,
          clicks: 190,
          orders: 12,
          revenue: 2720,
          roas: 1.7,
        },
      ],
    },
    meesho: {
      wallet: 0,
      kpis: { spend: 980, revenue: 2140, roas: 2.18, impressions: 41000, clicks: 520, orders: 9 },
      extras: [
        { label: 'Live', value: '2' },
        { label: 'Avg ROI', value: '2.18' },
        { label: 'Recommendations', value: '1' },
      ],
      trend: [3, 5, 6, 8, 7, 10, 12, 11, 14, 13, 16],
      campaigns: [
        {
          id: 'm3-1',
          name: 'Gym accessories catalog',
          type: '1 Catalog',
          status: 'LIVE',
          duration: '08 Oct 2026 – No end date',
          budgetLabel: '₹180 daily',
          spend: 720,
          impressions: 30200,
          clicks: 390,
          orders: 7,
          revenue: 1680,
          roas: 2.33,
        },
        {
          id: 'm3-2',
          name: 'Shaker bottles · auto',
          type: 'Auto Catalogs',
          status: 'LIVE',
          duration: '16 Oct 2026 – Till budget lasts',
          budgetLabel: '₹400 total',
          spend: 260,
          impressions: 10800,
          clicks: 130,
          orders: 2,
          revenue: 460,
          roas: 1.77,
        },
      ],
    },
    flipkart: {
      wallet: 1302.87,
      kpis: { spend: 3400, revenue: 4730, roas: 1.39, impressions: 45000, clicks: 406, orders: 4 },
      extras: [
        { label: 'CTR', value: '0.90%' },
        { label: 'CVR', value: '0.99%' },
        { label: 'Units sold', value: '4' },
      ],
      trend: [8, 10, 12, 11, 14, 16, 18, 15, 20, 22, 19],
      campaigns: [
        {
          id: 'f3-1',
          name: 'tmg keywords ads',
          type: 'PLA',
          status: 'LIVE',
          duration: '13 Oct \'26 – Till budget ends',
          budgetLabel: '₹300 daily',
          spend: 1991,
          impressions: 13807,
          clicks: 140,
          orders: 2,
          revenue: 2480,
          roas: 1.25,
        },
        {
          id: 'f3-2',
          name: 'HMB Advertisement Campaign',
          type: 'PLA',
          status: 'LIVE',
          duration: '17 Sep \'25 – Till budget ends',
          budgetLabel: '₹300 daily',
          spend: 114,
          impressions: 1678,
          clicks: 19,
          orders: 0,
          revenue: 0,
          roas: 0,
        },
        {
          id: 'f3-3',
          name: '4september',
          type: 'PLA',
          status: 'PAUSED',
          duration: '04 Sep \'25 – Till budget ends',
          budgetLabel: '₹1,000 daily',
          spend: 455,
          impressions: 3987,
          clicks: 29,
          orders: 1,
          revenue: 890,
          roas: 1.96,
        },
        {
          id: 'f3-4',
          name: 'PLA_Campaign-2025-12-12',
          type: 'PLA',
          status: 'LIVE',
          duration: '12 Dec \'25 – Till budget ends',
          budgetLabel: '₹300 daily',
          spend: 828,
          impressions: 21663,
          clicks: 204,
          orders: 1,
          revenue: 1360,
          roas: 1.64,
        },
      ],
    },
    amazon: {
      wallet: 980,
      kpis: { spend: 6120, revenue: 8440, roas: 1.38, impressions: 76400, clicks: 610, orders: 22 },
      extras: [
        { label: 'DPV', value: '410' },
        { label: 'NTB purchases', value: '4' },
        { label: 'Branded searches', value: '7' },
      ],
      trend: [11, 13, 12, 16, 18, 17, 21, 24, 22, 26, 25],
      campaigns: [
        {
          id: 'a3-1',
          name: 'Whey SP · exact',
          type: 'Sponsored Products · Manual',
          status: 'LIVE',
          duration: '01 Aug 2026 – No end date',
          budgetLabel: '₹90 / day',
          spend: 4480,
          impressions: 52000,
          clicks: 430,
          orders: 16,
          revenue: 6200,
          roas: 1.38,
        },
        {
          id: 'a3-2',
          name: 'Accessories SP · auto',
          type: 'Sponsored Products · Automatic',
          status: 'PAUSED',
          duration: '20 Jul 2026 – No end date',
          budgetLabel: '₹40 / day',
          spend: 1640,
          impressions: 24400,
          clicks: 180,
          orders: 6,
          revenue: 2240,
          roas: 1.37,
        },
      ],
    },
    google: {
      wallet: 2100,
      kpis: { spend: 8900, revenue: 14200, roas: 1.60, impressions: 96000, clicks: 1280, orders: 38 },
      extras: [
        { label: 'CTR', value: '1.33%' },
        { label: 'Avg CPC', value: '₹6.95' },
        { label: 'Conversions', value: '38' },
      ],
      trend: [8, 10, 12, 11, 14, 16, 18, 17, 20, 22, 21],
      campaigns: [
        {
          id: 'g3-1',
          name: 'Whey isolate Search',
          type: 'Search',
          status: 'LIVE',
          duration: '01 Aug 2026 – No end date',
          budgetLabel: '₹450 / day',
          spend: 6100,
          impressions: 52000,
          clicks: 860,
          orders: 26,
          revenue: 9800,
          roas: 1.61,
        },
        {
          id: 'g3-2',
          name: 'Gym accessories · Display',
          type: 'Display',
          status: 'PAUSED',
          duration: '20 Jul 2026 – No end date',
          budgetLabel: '₹250 / day',
          spend: 2800,
          impressions: 44000,
          clicks: 420,
          orders: 12,
          revenue: 4400,
          roas: 1.57,
        },
      ],
    },
  },
];

function metaCampaign(
  id: string,
  name: string,
  type: string,
  status: CampaignStatus,
  budgetLabel: string,
  spend: number,
  impressions: number,
  clicks: number,
  orders: number,
): MarketplaceCampaign {
  const revenue = orders > 0 ? Math.round(spend * (orders > 4 ? 1.8 : 1.2)) : 0;
  return {
    id,
    name,
    type,
    status,
    duration: 'No end date',
    budgetLabel,
    spend,
    impressions,
    clicks,
    orders,
    revenue,
    roas: spend > 0 && revenue > 0 ? revenue / spend : 0,
  };
}

const META_SAMPLE: MarketplaceSnapshot[] = [
  {
    wallet: 12400,
    kpis: { spend: 18640, revenue: 31220, roas: 1.67, impressions: 214000, clicks: 2860, orders: 94 },
    extras: [
      { label: 'Active', value: '2' },
      { label: 'Leads', value: '94' },
      { label: 'CPL', value: '₹198' },
    ],
    trend: [12, 16, 18, 22, 20, 26, 30, 28, 34, 36, 40],
    campaigns: [
      metaCampaign('d-m1', 'Dastkar festive handicrafts', 'LEADS', 'LIVE', '₹500.00 Daily', 8420, 98000, 1240, 48),
      metaCampaign('d-m2', 'Dastkar D2C shop', 'SALES', 'LIVE', '₹300.00 Daily', 6120, 72000, 890, 32),
      metaCampaign('d-m3', 'Dastkar crafts · 14 may 2026', 'LEADS', 'PAUSED', '₹300.00 Daily', 2100, 24000, 410, 8),
      metaCampaign('d-m4', 'Dastkar Instagram post: Hello!', 'OUTCOME_ENGAGEMENT', 'PAUSED', '₹200.00 Daily', 2000, 20000, 320, 6),
      metaCampaign('d-m5', 'Dastkar new arrival 16 DEC 2025', 'LEADS', 'PAUSED', '₹300.00 Daily', 0, 0, 0, 0),
    ],
  },
  {
    wallet: 8600,
    kpis: { spend: 14280, revenue: 26840, roas: 1.88, impressions: 168000, clicks: 2210, orders: 76 },
    extras: [
      { label: 'Active', value: '2' },
      { label: 'Leads', value: '76' },
      { label: 'CPL', value: '₹188' },
    ],
    trend: [10, 14, 16, 18, 22, 24, 26, 30, 28, 32, 34],
    campaigns: [
      metaCampaign('s-m1', 'Sitara Beauty glow leads', 'LEADS', 'LIVE', '₹400.00 Daily', 7640, 86000, 1180, 44),
      metaCampaign('s-m2', 'Sitara serum D2C', 'SALES', 'LIVE', '₹300.00 Daily', 4480, 52000, 640, 22),
      metaCampaign('s-m3', 'Sitara 14 may 2026', 'LEADS', 'PAUSED', '₹300.00 Daily', 2160, 30000, 390, 10),
      metaCampaign('s-m4', 'Sitara d2c 23 feb', 'SALES', 'PAUSED', '₹300.00 Daily', 0, 0, 0, 0),
      metaCampaign('s-m5', 'Sitara Instagram post: Hello!', 'OUTCOME_ENGAGEMENT', 'PAUSED', '₹200.00 Daily', 0, 0, 0, 0),
    ],
  },
  {
    wallet: 5400,
    kpis: { spend: 0, revenue: 0, roas: 0, impressions: 0, clicks: 0, orders: 0 },
    extras: [
      { label: 'Active', value: '1' },
      { label: 'Leads', value: '0' },
      { label: 'CPL', value: '—' },
    ],
    trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    campaigns: [
      metaCampaign('p-m1', 'leads 14 may 2026', 'LEADS', 'LIVE', '₹300.00 Daily', 0, 0, 0, 0),
      metaCampaign('p-m2', 'd2c 23 feb', 'SALES', 'PAUSED', '₹300.00 Daily', 0, 0, 0, 0),
      metaCampaign('p-m3', 'leads 20 feb 2026 - Copy', 'LEADS', 'PAUSED', '₹300.00 Daily', 0, 0, 0, 0),
      metaCampaign('p-m4', 'leads 16 feb 2026', 'LEADS', 'PAUSED', '₹300.00 Daily', 0, 0, 0, 0),
      metaCampaign('p-m5', 'LEADS 16DEC2025 NEW ARRIVAL', 'LEADS', 'PAUSED', '₹300.00 Daily', 0, 0, 0, 0),
      metaCampaign('p-m6', 'AD D2C 2 AD SET 16 DEC 2025', 'SALES', 'PAUSED', '₹200.00 Daily', 0, 0, 0, 0),
      metaCampaign('p-m7', 'ertefa sales ab', 'SALES', 'PAUSED', '₹500.00 Daily', 0, 0, 0, 0),
      metaCampaign('p-m8', 'ertefa in 22 sep', 'SALES', 'PAUSED', '₹1,000.00 Daily', 0, 0, 0, 0),
      metaCampaign('p-m9', 'Instagram post: Hello!', 'OUTCOME_ENGAGEMENT', 'PAUSED', '₹200.00 Daily', 0, 0, 0, 0),
      metaCampaign('p-m10', 'Instagram post: Hello! All retailers…', 'OUTCOME_ENGAGEMENT', 'PAUSED', '₹200.00 Daily', 0, 0, 0, 0),
    ],
  },
];

export function pickMarketplaceClients(rows: MarketplaceClientOption[]): MarketplaceClientOption[] {
  const unused = [...rows];
  return PREFERRED_SAMPLE_CLIENTS.map((pref, index) => {
    const matchIndex = unused.findIndex((row) => pref.match.test(row.name));
    if (matchIndex >= 0) {
      const [found] = unused.splice(matchIndex, 1);
      return found;
    }
    return {
      id: `demo-${index + 1}`,
      name: pref.name,
      organizationName: 'Sample',
      isDemo: true,
    };
  });
}

export function padMarketplaceClients(rows: MarketplaceClientOption[]): MarketplaceClientOption[] {
  return pickMarketplaceClients(rows);
}

export function snapshotFor(slot: number, marketplace: MarketplaceId): MarketplaceSnapshot {
  const index = Math.min(Math.max(slot, 0), MARKETPLACE_CLIENT_SLOTS - 1);
  if (marketplace === 'meta') return META_SAMPLE[index];
  return MARKETPLACE_SAMPLE[index][marketplace];
}
