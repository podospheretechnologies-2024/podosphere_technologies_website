export const PLAN_KEYS = ['solo', 'agency_starter', 'agency_growth', 'agency_pro'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export type PlanFeature =
  | 'scheduling'
  | 'ai'
  | 'analytics'
  | 'approvals'
  | 'reports'
  | 'inbox'
  | 'broadcasts'
  | 'whatsapp'
  | 'ads'
  | 'leads'
  | 'api';

export interface PlanDefinition {
  key: PlanKey;
  label: string;
  priceInr: number;
  maxClients: number;
  maxUsers: number;
  maxChannels: number;
  features: readonly PlanFeature[];
}

export const PLANS: Record<PlanKey, PlanDefinition> = {
  solo: {
    key: 'solo',
    label: 'Solo',
    priceInr: 1499,
    maxClients: 3,
    maxUsers: 2,
    maxChannels: 6,
    features: ['scheduling', 'ai', 'analytics', 'whatsapp'],
  },
  agency_starter: {
    key: 'agency_starter',
    label: 'Agency Starter',
    priceInr: 4999,
    maxClients: 10,
    maxUsers: 5,
    maxChannels: 20,
    features: ['scheduling', 'ai', 'analytics', 'whatsapp', 'approvals', 'reports', 'inbox', 'broadcasts'],
  },
  agency_growth: {
    key: 'agency_growth',
    label: 'Agency Growth',
    priceInr: 9999,
    maxClients: 25,
    maxUsers: 15,
    maxChannels: 50,
    features: [
      'scheduling',
      'ai',
      'analytics',
      'whatsapp',
      'approvals',
      'reports',
      'inbox',
      'broadcasts',
      'ads',
      'leads',
    ],
  },
  agency_pro: {
    key: 'agency_pro',
    label: 'Agency Pro',
    priceInr: 19999,
    maxClients: 60,
    maxUsers: 999,
    maxChannels: 150,
    features: [
      'scheduling',
      'ai',
      'analytics',
      'whatsapp',
      'approvals',
      'reports',
      'inbox',
      'broadcasts',
      'ads',
      'leads',
      'api',
    ],
  },
};

export function isPlanKey(value: string): value is PlanKey {
  return (PLAN_KEYS as readonly string[]).includes(value);
}

export function planOrDefault(value: string | null | undefined): PlanDefinition {
  return isPlanKey(value ?? '') ? PLANS[value as PlanKey] : PLANS.agency_starter;
}
