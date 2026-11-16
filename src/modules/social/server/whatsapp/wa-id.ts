/** Leads typed without a country code are assumed to be Indian numbers. */
const DEFAULT_COUNTRY_CODE = '91';

/** Phone as WhatsApp wants it: digits only, with country code. Null when it can't be a number. */
export function toWaId(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const international = phone.trim().startsWith('+');
  let digits = phone.replace(/\D/g, '');
  if (!international) {
    digits = digits.replace(/^0+/, '');
    if (digits.length === 10) digits = DEFAULT_COUNTRY_CODE + digits;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}
