import 'server-only';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function methodNotAllowed(allow: string): Response {
  return Response.json(
    { error: `This endpoint only accepts ${allow}` },
    { status: 405, headers: { Allow: allow } }
  );
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    const message = error.issues.map((issue) => issue.message).join(', ');
    return Response.json({ error: message }, { status: 400 });
  }

  console.error(error);
  return Response.json({ error: 'Something went wrong' }, { status: 500 });
}
