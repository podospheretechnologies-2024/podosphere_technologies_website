import type { NextRequest } from 'next/server';
import { CSV_IMPORT_MAX_BYTES } from '@/modules/social/config/csv-import';
import { csvImportPreviewSchema } from '@/modules/social/server/posts/csv-import.schema';
import { csvImportService } from '@/modules/social/server/posts/csv-import.service';
import { getClientScope } from '@/shared/server/client-scope';
import { errorResponse, HttpError } from '@/shared/server/http-error';

async function readCsvFromRequest(request: NextRequest): Promise<{ csv: string; timeZone?: string }> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    const timeZone = form.get('timeZone');
    if (!(file instanceof File)) {
      throw new HttpError(400, 'Upload a CSV file under the "file" field');
    }
    if (file.size > CSV_IMPORT_MAX_BYTES) {
      throw new HttpError(400, 'CSV is too large (max 1 MB)');
    }
    return {
      csv: await file.text(),
      timeZone:
        typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : undefined,
    };
  }

  const body = (await request.json()) as { csv?: string; timeZone?: string };
  return {
    csv: body.csv ?? '',
    timeZone: body.timeZone?.trim() || undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const scope = await getClientScope('publish');
    const raw = await readCsvFromRequest(request);
    const body = csvImportPreviewSchema.parse(raw);
    return Response.json(await csvImportService.preview(scope, body));
  } catch (error) {
    return errorResponse(error);
  }
}
