/**
 * Strips all non-digit characters from a string.
 */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Formats a raw phone string for display as (XXX) XXX-XXXX.
 * Handles 10-digit numbers and 11-digit numbers with leading country code 1.
 * Returns "—" for null/empty, returns the raw value unchanged if it can't be formatted.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const digits = digitsOnly(raw);
  const d = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw;
}

/**
 * Formats a phone string progressively as the user types.
 * Produces: (XXX, (XXX) XXX, (XXX) XXX-XXXX
 * Strips non-digits and caps at 10 digits.
 */
export function formatPhoneInput(value: string): string {
  const digits = digitsOnly(value).slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
