import 'server-only';
import { z } from 'zod';
import { BRANDED_TEMPLATE_IDS } from '../../config/branded-templates';

export const renderBrandedTemplateSchema = z.object({
  templateId: z.enum(BRANDED_TEMPLATE_IDS),
  values: z.record(z.string(), z.string().trim().max(300)).default({}),
});

export type RenderBrandedTemplateBody = z.infer<typeof renderBrandedTemplateSchema>;
