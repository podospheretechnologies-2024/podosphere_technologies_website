import { prisma } from '@/shared/lib/prisma';

// Public: used by uptime checks, so it must not need a login.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check failed', error);
    return Response.json({ status: 'error', database: 'unreachable' }, { status: 503 });
  }
}
