import 'server-only';
import { z } from 'zod';
import { CLIENT_PERMISSION_IDS } from '../config/client-permissions';

/** Clients a MEMBER may see, each with its permission list (SocialClientMember rows). */
export const clientAccessSchema = z
  .array(
    z.object({
      customerId: z.string().min(1).max(64),
      permissions: z.array(z.enum(CLIENT_PERMISSION_IDS)).min(1).max(CLIENT_PERMISSION_IDS.length),
    })
  )
  .max(500);

// Staff invites can only grant ADMIN or MEMBER. There is exactly one OWNER per organization
// (created by the seed / super-admin), and it is never handed out through an invite link.
export const createInvitationSchema = z.object({
  email: z.email('Enter a valid email').max(191).transform((value) => value.toLowerCase()),
  role: z.enum(['ADMIN', 'MEMBER']),
  /** MEMBER only: the clients they will see once they accept. Ignored for ADMIN (sees all). */
  clientAccess: clientAccessSchema.default([]),
});

export const setMemberClientsSchema = z.object({ clients: clientAccessSchema });

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Missing invite token'),
  name: z.string().trim().min(1, 'Your name is required').max(191),
  password: z.string().min(8, 'Use at least 8 characters for the password').max(200),
});

export type CreateInvitationBody = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationBody = z.infer<typeof acceptInvitationSchema>;
export type SetMemberClientsBody = z.infer<typeof setMemberClientsSchema>;
