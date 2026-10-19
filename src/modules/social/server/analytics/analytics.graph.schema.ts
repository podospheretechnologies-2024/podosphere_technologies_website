import { z } from 'zod';

/** One media node under business_discovery.media. */
export const competitorDiscoveryMediaSchema = z
  .object({
    id: z.string().min(1),
    caption: z.string().optional().nullable().catch(null),
    like_count: z.coerce.number().int().nonnegative().catch(0),
    comments_count: z.coerce.number().int().nonnegative().catch(0),
    media_type: z.string().optional().nullable().catch(null),
    permalink: z.string().optional().nullable().catch(null),
    timestamp: z.string().optional().nullable().catch(null),
    media_url: z.string().optional().nullable().catch(null),
    thumbnail_url: z.string().optional().nullable().catch(null),
  })
  .passthrough();

const graphListPagingSchema = z
  .object({
    next: z.string().optional(),
    cursors: z
      .object({
        after: z.string().optional(),
        before: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()
  .optional();

/** Instagram Business Discovery fields used by competitor sync (followers + recent media). */
export const businessDiscoveryNodeSchema = z
  .object({
    id: z.string().optional(),
    followers_count: z.coerce.number().int().nonnegative().catch(0),
    media_count: z.coerce.number().int().nonnegative().catch(0),
    media: z
      .object({
        data: z.array(z.unknown()).catch([]),
        paging: graphListPagingSchema,
      })
      .passthrough()
      .optional()
      .catch(undefined),
  })
  .passthrough();

export const competitorDiscoveryResponseSchema = z
  .object({
    business_discovery: businessDiscoveryNodeSchema.optional().catch(undefined),
  })
  .passthrough();

export type CompetitorDiscoveryResponse = z.infer<typeof competitorDiscoveryResponseSchema>;
export type BusinessDiscoveryNode = z.infer<typeof businessDiscoveryNodeSchema>;
export type CompetitorDiscoveryMedia = z.infer<typeof competitorDiscoveryMediaSchema>;
