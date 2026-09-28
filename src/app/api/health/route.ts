import { getCurrentOrganization } from '@/shared/server/current-organization';

export async function GET() {
  try {
    const organization = await getCurrentOrganization();
    return Response.json({
      status: 'ok',
      database: 'connected',
      organization: organization.slug,
    });
  } catch (error) {
    console.error('Health check failed', error);
    return Response.json({ status: 'error', database: 'unreachable' }, { status: 503 });
  }
}
