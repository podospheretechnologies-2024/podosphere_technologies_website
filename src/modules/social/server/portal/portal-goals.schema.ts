import 'server-only';
import { z } from 'zod';

export const portalGoalsSchema = z.object({
  leadsPerMonth: z.number().int().min(0).max(1_000_000).nullable().optional(),
  postsPerMonth: z.number().int().min(0).max(10_000).nullable().optional(),
  /** Planned ad budget for the calendar month (same currency as Meta accounts). */
  adBudgetPerMonth: z.number().min(0).max(100_000_000).nullable().optional(),
});

export type PortalGoalsConfig = z.infer<typeof portalGoalsSchema>;

export function parsePortalGoals(value: unknown): PortalGoalsConfig {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return {};
  const parsed = portalGoalsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}
