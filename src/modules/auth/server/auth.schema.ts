import 'server-only';
import { z } from 'zod';

export const registerSchema = z
  .object({
    organizationName: z.string().trim().min(1, 'Company / workspace name is required').max(191),
    name: z.string().trim().min(1, 'Your name is required').max(191),
    email: z.email('Enter a valid email').max(191).transform((value) => value.toLowerCase()),
    password: z.string().min(8, 'Use at least 8 characters for the password').max(200),
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Passwords do not match',
  });

export const loginSchema = z.object({
  email: z.email('Enter a valid email').transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Enter your password'),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
