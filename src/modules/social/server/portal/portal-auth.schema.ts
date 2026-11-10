import 'server-only';
import { z } from 'zod';

const email = z.email('Enter a valid email').max(191).transform((value) => value.toLowerCase());
const password = z.string().min(8, 'Use at least 8 characters').max(200);

export const portalLoginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean().optional().default(false),
});

export const portalChangePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    password,
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Passwords do not match',
  });

export const portalSetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password,
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Passwords do not match',
  });

export const createPortalApproverSchema = z.object({
  email,
  name: z.string().trim().min(1, 'Name is required').max(191),
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const digits = value.replace(/\D/g, '');
      return digits.length >= 10 ? digits : undefined;
    }),
});

export const updatePortalApproverSchema = z.object({
  disabled: z.boolean().optional(),
  phone: z
    .string()
    .trim()
    .max(32)
    .nullable()
    .optional()
    .transform((value) => {
      if (value === null) return null;
      if (value === undefined) return undefined;
      const digits = value.replace(/\D/g, '');
      return digits.length >= 10 ? digits : null;
    }),
});

export const portalApproverPasswordActionSchema = z.object({
  action: z.enum(['generate', 'send_link']),
});

export type PortalLoginBody = z.infer<typeof portalLoginSchema>;
export type PortalChangePasswordBody = z.infer<typeof portalChangePasswordSchema>;
export type PortalSetPasswordBody = z.infer<typeof portalSetPasswordSchema>;
export type CreatePortalApproverBody = z.infer<typeof createPortalApproverSchema>;
