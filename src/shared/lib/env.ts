import 'server-only';
import { z } from 'zod';

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url().default('http://localhost:3000'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  STORAGE_PROVIDER: z.enum(['local']).default('local'),
  UPLOAD_DIRECTORY: z.string().min(1).default('uploads'),
  ENCRYPTION_KEY: z.string().min(32, 'must be at least 32 characters'),
  // AI features are switched off while no key is set.
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default('gpt-4.1'),
  OPENAI_IMAGE_MODEL: z.string().min(1).default('gpt-image-1'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server environment variables:\n${issues}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
