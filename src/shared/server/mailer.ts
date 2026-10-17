import 'server-only';
import { Resend } from 'resend';
import { legal } from '@/modules/marketing/config/legal';

const DEFAULT_FROM = `Podo Social <noreply@podospheretechnologies.com>`;

export type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; error: string };

function resolveFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Thin Resend wrapper. Missing `RESEND_API_KEY` skips send (logs + returns)
 * so workers/API never crash when email is not configured.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.log('[mailer] RESEND_API_KEY not set — skipping email');
    return { ok: false, skipped: true, reason: 'RESEND_API_KEY not set' };
  }

  const to = Array.isArray(input.to) ? input.to : [input.to];
  const recipients = to.map((addr) => addr.trim()).filter(Boolean);
  if (recipients.length === 0) {
    console.log('[mailer] no recipients — skipping email');
    return { ok: false, skipped: true, reason: 'no recipients' };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: resolveFrom(),
      to: recipients,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo ?? legal.contactEmail,
      attachments: input.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
      })),
    });

    if (error) {
      console.error('[mailer] Resend error:', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id ?? 'unknown' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[mailer] send failed:', message);
    return { ok: false, error: message };
  }
}

export const mailer = {
  isConfigured,
  sendEmail,
  resolveFrom,
};
