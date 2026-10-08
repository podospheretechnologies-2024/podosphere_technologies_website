import 'server-only';
import { z } from 'zod';

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url().default('http://localhost:3000'),
  // MySQL 8.4 (docker-compose). phpMyAdmin: http://localhost:8086
  DATABASE_URL: z.string().startsWith('mysql://', 'must be a mysql:// URL'),
  REDIS_URL: z.url(),
  STORAGE_PROVIDER: z.enum(['local']).default('local'),
  UPLOAD_DIRECTORY: z.string().min(1).default('uploads'),
  ENCRYPTION_KEY: z.string().min(32, 'must be at least 32 characters'),
  // Signs the login session cookie (HS256).
  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters'),
  // Podo AI (text) runs on Claude and is switched off while no key is set.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-opus-5'),
  AI_DEFAULT_MONTHLY_BUDGET_USD: z.coerce.number().positive().default(50),
  // Image generation only (Claude doesn't generate images). Optional.
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().min(1).default('gpt-image-1'),
  // Meta (Facebook / Instagram). See PODO_SOCIAL.md sections 8–10.
  META_GRAPH_VERSION: z.string().default('v26.0'),
  META_APP_SECRET: z.string().optional(),
  META_PAGE_ID: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional(),
  // Business Manager system user token with ads_read: reads ad accounts, campaigns and insights.
  META_SYSTEM_USER_TOKEN: z.string().optional(),
  // Dev only: Graph API Explorer user token for quick testing. Ignored in production.
  META_TEST_USER_TOKEN: z.string().optional(),
  // Meta webhook verify token (WhatsApp + Page callbacks).
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  // WhatsApp Cloud API: system user token with whatsapp_business_messaging + whatsapp_business_management.
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  // Needed to list message templates; sending plain text works without it.
  WHATSAPP_WABA_ID: z.string().optional(),
  // Route B: forward Meta WhatsApp webhooks to PodoCRM (Meta URL stays on Social).
  PODOCRM_WHATSAPP_WEBHOOK_URL: z.url().optional(),
  // Set to "false" to disable forwarding. Default: on in production (uses URL or built-in default).
  PODOCRM_WHATSAPP_FORWARD: z.enum(['true', 'false']).optional(),
  // PodoCRM API base for WhatsApp sync link/ping/echo (no trailing slash required).
  PODOCRM_API_BASE_URL: z.url().optional(),
  // Google Sheets plug (OAuth). Optional — Connect stays disabled until both are set.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Meta app id for WhatsApp Embedded Signup (client-side FB.login).
  META_APP_ID: z.string().optional(),
  WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: z.string().optional(),
  // Razorpay subscriptions. Optional until billing is turned on.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
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
