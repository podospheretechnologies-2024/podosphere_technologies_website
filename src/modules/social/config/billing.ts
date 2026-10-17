import type { PlanKey } from './plans';

/** Map plan keys → Razorpay Plan IDs (subscriptions). Empty = order-based checkout only. */
export function razorpayPlanId(plan: PlanKey): string | null {
  const map: Record<PlanKey, string | undefined> = {
    solo: process.env.RAZORPAY_PLAN_SOLO,
    agency_starter: process.env.RAZORPAY_PLAN_AGENCY_STARTER,
    agency_growth: process.env.RAZORPAY_PLAN_AGENCY_GROWTH,
    agency_pro: process.env.RAZORPAY_PLAN_AGENCY_PRO,
  };
  const id = map[plan]?.trim();
  return id || null;
}

/** Seller GSTIN printed on invoices (optional until live billing). */
export function billingSellerGstin(): string | null {
  return process.env.BILLING_SELLER_GSTIN?.trim() || null;
}

/**
 * Seller place-of-supply / state code for GST split.
 * Prefer BILLING_SELLER_STATE; else first two digits of seller GSTIN.
 */
export function billingSellerStateCode(): string | null {
  const explicit = process.env.BILLING_SELLER_STATE?.trim();
  if (explicit) return explicit.slice(0, 2).toUpperCase();
  const gstin = billingSellerGstin();
  if (gstin && /^\d{2}/.test(gstin)) return gstin.slice(0, 2);
  return null;
}

/** CGST+SGST (intra-state) rate as percent; default 18 → 9+9. */
export function billingGstPercent(): number {
  const raw = Number(process.env.BILLING_GST_PERCENT ?? '18');
  return Number.isFinite(raw) && raw >= 0 ? raw : 18;
}

/** Normalize place of supply / GSTIN into a 2-digit GST state code when possible. */
export function gstStateCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{2}/.test(trimmed)) return trimmed.slice(0, 2);
  return null;
}

/** Estimated Meta template message cost in paise (default ₹0.80 = 80 paise). */
export function whatsappBroadcastRatePaise(): number {
  const raw = Number(process.env.WHATSAPP_BROADCAST_RATE_PAISE ?? '80');
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 80;
}
