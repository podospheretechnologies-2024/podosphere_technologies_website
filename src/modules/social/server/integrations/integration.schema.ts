import { z } from 'zod';

export const connectQuerySchema = z.object({
  refresh: z.string().min(1).optional(),
});

export const callbackQuerySchema = z.union([
  z.object({ code: z.string().min(1), state: z.string().min(1) }),
  z.object({
    error: z.string().min(1),
    error_description: z.string().optional(),
  }),
]);

export const updateIntegrationSchema = z.object({
  disabled: z.boolean(),
});

export type CallbackQuery = z.infer<typeof callbackQuerySchema>;
