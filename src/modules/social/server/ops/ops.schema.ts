import 'server-only';
import { z } from 'zod';
import {
  OPS_CLIENT_STATUSES,
  OPS_ENGAGEMENT_TYPES,
  OPS_SERVICE_CATEGORIES,
} from './ops.constants';

const emptyToNull = z.literal('').transform(() => null);

export const opsServiceInputSchema = z.object({
  category: z.enum(OPS_SERVICE_CATEGORIES),
  subtype: z.string().trim().min(1).max(80),
  groupLabel: z.union([z.string().trim().max(64), emptyToNull]).optional().nullable(),
});

export const createOpsClientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  status: z.enum(OPS_CLIENT_STATUSES).optional(),
  engagementType: z.union([z.enum(OPS_ENGAGEMENT_TYPES), emptyToNull]).optional().nullable(),
  monthlyFee: z.union([z.number().nonnegative().max(1e9), emptyToNull]).optional().nullable(),
  retainerStart: z.union([z.iso.date(), emptyToNull]).optional().nullable(),
  retainerMonths: z.union([z.number().int().positive().max(120), emptyToNull]).optional().nullable(),
  teamNames: z.union([z.string().trim().max(500), emptyToNull]).optional().nullable(),
  notes: z.union([z.string().trim().max(5000), emptyToNull]).optional().nullable(),
  workStatus: z.union([z.string().trim().max(64), emptyToNull]).optional().nullable(),
  escalation: z.union([z.string().trim().max(64), emptyToNull]).optional().nullable(),
  category: z.union([z.string().trim().max(64), emptyToNull]).optional().nullable(),
  socialCustomerId: z.union([z.string().uuid(), emptyToNull]).optional().nullable(),
  services: z.array(opsServiceInputSchema).max(40).optional(),
});

export const updateOpsClientSchema = createOpsClientSchema.partial().extend({
  name: z.string().trim().min(1).max(160).optional(),
});

export const createOpsPaymentSchema = z.object({
  clientId: z.string().uuid(),
  amount: z.union([z.number().nonnegative().max(1e9), emptyToNull]).optional().nullable(),
  description: z.union([z.string().trim().max(500), emptyToNull]).optional().nullable(),
  dueDate: z.union([z.iso.date(), emptyToNull]).optional().nullable(),
  monthKey: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  markPaid: z.boolean().optional(),
});

export const updateOpsPaymentSchema = z.object({
  amount: z.union([z.number().nonnegative().max(1e9), emptyToNull]).optional().nullable(),
  description: z.union([z.string().trim().max(500), emptyToNull]).optional().nullable(),
  dueDate: z.union([z.iso.date(), emptyToNull]).optional().nullable(),
  monthKey: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  paidAt: z.union([z.iso.datetime(), z.null()]).optional(),
  markPaid: z.boolean().optional(),
});

export type CreateOpsClientBody = z.infer<typeof createOpsClientSchema>;
export type UpdateOpsClientBody = z.infer<typeof updateOpsClientSchema>;
export type CreateOpsPaymentBody = z.infer<typeof createOpsPaymentSchema>;
export type UpdateOpsPaymentBody = z.infer<typeof updateOpsPaymentSchema>;
