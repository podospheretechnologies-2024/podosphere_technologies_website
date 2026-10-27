import 'server-only';
import { z } from 'zod';

// Staff invites can only grant ADMIN or MEMBER. There is exactly one OWNER per organization
// (created by the seed / super-admin), and it is never handed out through an invite link.
export const createInvitationSchema = z.object({
  email: z.email('Enter a valid email').max(191).transform((value) => value.toLowerCase()),
  role: z.enum(['ADMIN', 'MEMBER']),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Missing invite token'),
  name: z.string().trim().min(1, 'Your name is required').max(191),
  password: z.string().min(8, 'Use at least 8 characters for the password').max(200),
});

export type CreateInvitationBody = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationBody = z.infer<typeof acceptInvitationSchema>;
