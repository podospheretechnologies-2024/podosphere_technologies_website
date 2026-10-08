import 'server-only';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/shared/lib/prisma';
import { HttpError } from '@/shared/server/http-error';
import type { CurrentUserItem } from '../types';
import type { LoginBody, RegisterBody } from './auth.schema';
import type { CurrentUser } from './session';

const BCRYPT_ROUNDS = 12;

let dummyHashPromise: Promise<string> | undefined;
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
function dummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash('podo-dummy-password', BCRYPT_ROUNDS);
  return dummyHashPromise;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'workspace'}-${randomBytes(3).toString('hex')}`;
}

export function toCurrentUserItem(user: CurrentUser): CurrentUserItem {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: { id: user.organization.id, name: user.organization.name },
  };
}

export const authService = {
  /** Creates an organization and its owner. */
  async register(body: RegisterBody): Promise<CurrentUser> {
    throw new HttpError(403, 'Registration is currently invite-only.');
    
    if (await prisma.user.findUnique({ where: { email: body.email } })) {
      throw new HttpError(409, 'An account with this email already exists');
    }

    return prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, BCRYPT_ROUNDS),
        role: 'OWNER',
        organization: { create: { name: body.organizationName, slug: slugify(body.organizationName) } },
      },
      include: { organization: true },
    });
  },

  async login(body: LoginBody): Promise<CurrentUser> {
    const user = await prisma.user.findFirst({
      where: { email: body.email, deletedAt: null },
      include: { organization: true },
    });
    const valid = await bcrypt.compare(body.password, user?.passwordHash ?? (await dummyHash()));
    if (!user || !valid) {
      throw new HttpError(401, 'Invalid email or password');
    }
    return user;
  },
};
