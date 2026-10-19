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
  // F13: vision alt + caption ideas on media upload. Soft-fails when off or when keys fail.
  // unset = on when ANTHROPIC_API_KEY or OPENAI_API_KEY is set.
  MEDIA_VISION_ENABLED: z.enum(['true', 'false']).optional(),
  // Meta (Facebook / Instagram). See PODO_SOCIAL.md sections 8–10.
  META_GRAPH_VERSION: z.string().default('v26.0'),
  META_APP_SECRET: z.string().optional(),
  META_PAGE_ID: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional(),
  // Bootstrap only: agency `me/adaccounts` sync. Per-account tokens live on AdAccount.accessTokenEncrypted;
  // the ads worker and live Graph reads never fall back to this env value.
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
  // Google Ads connector (reuses the Google OAuth client above). Connect stays disabled until the developer token is set.
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  // Manager (MCC) customer id, digits only; sent as login-customer-id when accounts are reached through it.
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().optional(),
  GOOGLE_ADS_API_VERSION: z.string().optional(),
  // Pinterest (OAuth + /v5/pins). Optional — Connect stays disabled until both are set.
  PINTEREST_CLIENT_ID: z.string().optional(),
  PINTEREST_CLIENT_SECRET: z.string().optional(),
  // Meta app id for WhatsApp Embedded Signup (client-side FB.login).
  META_APP_ID: z.string().optional(),
  WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: z.string().optional(),
  // Razorpay subscriptions / orders. Optional — checkout soft-fails until keys are set.
  // Webhook: /api/webhooks/razorpay (charged → active; halted → past_due; cancelled → cancelled). See ops-runbook.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // Razorpay Plan IDs (dashboard → Subscriptions → Plans). Set → real subscription; unset → one-time order.
  RAZORPAY_PLAN_SOLO: z.string().optional(),
  RAZORPAY_PLAN_AGENCY_STARTER: z.string().optional(),
  RAZORPAY_PLAN_AGENCY_GROWTH: z.string().optional(),
  RAZORPAY_PLAN_AGENCY_PRO: z.string().optional(),
  // GST invoices (seller GSTIN + optional state code for tax split + rate %).
  BILLING_SELLER_GSTIN: z.string().optional(),
  BILLING_SELLER_STATE: z.string().optional(),
  BILLING_GST_PERCENT: z.coerce.number().nonnegative().optional(),
  // WhatsApp broadcast cost estimate (paise per template message). Default 80 (₹0.80).
  WHATSAPP_BROADCAST_RATE_PAISE: z.coerce.number().nonnegative().optional(),
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
