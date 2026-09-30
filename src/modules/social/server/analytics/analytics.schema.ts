import 'server-only';
import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  startDate: z.iso.datetime({ offset: true }),
  endDate: z.iso.datetime({ offset: true }),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
