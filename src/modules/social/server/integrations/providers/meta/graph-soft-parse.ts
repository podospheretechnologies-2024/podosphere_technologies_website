import { z } from 'zod';

/** Format zod issues for worker logs (one line). */
function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

/**
 * Soft-parse unknown Graph JSON. On failure, log and return `fallback`
 * so sync jobs keep moving with safe defaults.
 */
export function softParseGraph<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string,
  fallback: T
): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;
  console.warn(`[graph] soft-parse failed (${context}): ${formatIssues(parsed.error)}`);
  return fallback;
}

/**
 * Soft-parse a list of Graph nodes. Invalid rows are skipped (and logged);
 * the rest are kept so one bad campaign does not drop the page.
 */
export function softParseGraphList<T>(
  itemSchema: z.ZodType<T>,
  items: unknown,
  context: string
): T[] {
  if (!Array.isArray(items)) {
    console.warn(`[graph] soft-parse failed (${context}): expected array`);
    return [];
  }

  const out: T[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const parsed = itemSchema.safeParse(items[i]);
    if (parsed.success) {
      out.push(parsed.data);
      continue;
    }
    console.warn(
      `[graph] soft-parse failed (${context}[${i}]): ${formatIssues(parsed.error)}`
    );
  }
  return out;
}
