import type { NextRequest } from 'next/server';
import { billingService } from '@/modules/social/server/billing/billing.service';
import { getCurrentOrganization } from '@/shared/server/current-organization';
import { requireRole } from '@/shared/server/access';
import { errorResponse, HttpError } from '@/shared/server/http-error';

type Params = { params: Promise<{ id: string }> };

/** Regenerate (or generate) the GST invoice PDF and refresh pdfUrl. */
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const organization = await getCurrentOrganization();
    const ctx = await requireRole('ADMIN');
    if (ctx.impersonatedBy) {
      throw new HttpError(403, 'Billing changes are not allowed while impersonating');
    }
    const { id } = await params;
    return Response.json(await billingService.regenerateInvoicePdf(organization.id, id));
  } catch (error) {
    return errorResponse(error);
  }
}
