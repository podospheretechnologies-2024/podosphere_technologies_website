import 'server-only';
import { z } from 'zod';
import { TAG_NAME_MAX_LENGTH } from '../../config/settings';

export const saveTagSchema = z.object({
  name: z.string().trim().min(1, 'Name the tag').max(TAG_NAME_MAX_LENGTH, 'Tag name is too long'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Pick a colour'),
});

export type SaveTagBody = z.infer<typeof saveTagSchema>;
