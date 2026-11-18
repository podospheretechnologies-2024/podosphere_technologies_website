import 'server-only';
import { z } from 'zod';
import { ORDER_FLOW_KEYS, ORDER_FLOW_VARIABLE_FIELDS } from '../../config/order-flows';

const flowKey = z.enum(ORDER_FLOW_KEYS);
const delayUnit = z.enum(['minutes', 'hours', 'days']);
const variableFieldKeys = ORDER_FLOW_VARIABLE_FIELDS.map((f) => f.key) as [
  (typeof ORDER_FLOW_VARIABLE_FIELDS)[number]['key'],
  ...(typeof ORDER_FLOW_VARIABLE_FIELDS)[number]['key'][],
];

export const patchOrderFlowSchema = z
  .object({
    enabled: z.boolean().optional(),
    templateName: z.string().trim().min(1).max(120).nullable().optional(),
    templateLanguage: z.string().trim().min(1).max(16).nullable().optional(),
    delayValue: z.number().int().min(0).max(365).nullable().optional(),
    delayUnit: delayUnit.nullable().optional(),
    onlyIf: z
      .object({
        minCartValue: z.number().min(0).nullable().optional(),
        paymentType: z.enum(['any', 'cod', 'prepaid']).nullable().optional(),
      })
      .nullable()
      .optional(),
    variableMap: z
      .record(
        z.string().max(32),
        z.union([z.enum(variableFieldKeys), z.string().max(64), z.null()])
      )
      .nullable()
      .optional(),
    stopIf: z
      .object({
        onOrderPlaced: z.boolean().optional(),
        onStopReply: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

/** Accept ISO datetime or YYYY-MM-DD from the activity/results date inputs. */
const dateOrDatetime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid date' });

export const listOrderFlowActivitySchema = z.object({
  flowKey: flowKey.optional(),
  status: z
    .enum(['waiting', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'skipped'])
    .optional(),
  from: dateOrDatetime.optional(),
  to: dateOrDatetime.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const listOrderFlowResultsSchema = z.object({
  from: dateOrDatetime.optional(),
  to: dateOrDatetime.optional(),
});

export const testOrderFlowSendSchema = z.object({
  to: z.string().trim().min(8).max(32),
});

export type PatchOrderFlowInput = z.infer<typeof patchOrderFlowSchema>;
export type ListOrderFlowActivityInput = z.infer<typeof listOrderFlowActivitySchema>;
export type ListOrderFlowResultsInput = z.infer<typeof listOrderFlowResultsSchema>;
export type TestOrderFlowSendInput = z.infer<typeof testOrderFlowSendSchema>;
