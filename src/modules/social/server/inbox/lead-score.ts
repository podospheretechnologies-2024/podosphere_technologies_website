import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { LEAD_STAGES, type LeadStage } from './inbox.schema';

const STAGE_POINTS: Record<LeadStage, number> = {
  new: 35,
  contacted: 50,
  qualified: 75,
  won: 100,
  lost: 5,
};

export interface LeadScoreInput {
  stage: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  payload?: unknown;
}

export interface LeadScoreResult {
  score: number;
  reasons: string[];
}

function payloadFieldCount(payload: unknown): number {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 0;
  return Object.keys(payload as Record<string, unknown>).filter((key) => {
    const value = (payload as Record<string, unknown>)[key];
    return value !== null && value !== undefined && String(value).trim() !== '';
  }).length;
}

/** Rule-based 0–100 score from pipeline stage + contact completeness. */
export function computeLeadScore(input: LeadScoreInput): LeadScoreResult {
  const reasons: string[] = [];
  let score = 0;

  const stage = (LEAD_STAGES as readonly string[]).includes(input.stage)
    ? (input.stage as LeadStage)
    : 'new';
  const stagePts = STAGE_POINTS[stage];
  score += stagePts;
  reasons.push(`Stage: ${stage} (+${stagePts})`);

  if (input.name?.trim()) {
    score += 10;
    reasons.push('Has name (+10)');
  }
  if (input.email?.trim()) {
    score += 15;
    reasons.push('Has email (+15)');
  }
  if (input.phone?.trim()) {
    score += 15;
    reasons.push('Has phone (+15)');
  }

  const fields = payloadFieldCount(input.payload);
  if (fields >= 4) {
    score += 10;
    reasons.push(`Rich form payload (${fields} fields) (+10)`);
  } else if (fields >= 2) {
    score += 5;
    reasons.push(`Form payload (${fields} fields) (+5)`);
  }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons };
}

export function scoreReasonsToJson(reasons: string[]): Prisma.InputJsonValue {
  return reasons as unknown as Prisma.InputJsonValue;
}

export function parseScoreReasons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}
