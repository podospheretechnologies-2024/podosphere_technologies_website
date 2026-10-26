import 'server-only';
import { z } from 'zod';
import {
  HASHTAG_GROUP_BODY_MAX_LENGTH,
  HASHTAG_GROUP_NAME_MAX_LENGTH,
} from '../../config/settings';

export const saveHashtagGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name the group')
    .max(HASHTAG_GROUP_NAME_MAX_LENGTH, 'Group name is too long'),
  hashtags: z
    .string()
    .trim()
    .min(1, 'Add at least one hashtag')
    .max(HASHTAG_GROUP_BODY_MAX_LENGTH, 'Too many hashtags'),
});

export type SaveHashtagGroupBody = z.infer<typeof saveHashtagGroupSchema>;
