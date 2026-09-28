import { destroySession } from '@/modules/auth/server/session';

export async function POST() {
  await destroySession();
  return new Response(null, { status: 204 });
}
