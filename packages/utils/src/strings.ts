/** Truncates a string to maxLength, appending an ellipsis if trimmed. */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/** Converts a string to a URL-safe slug. */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Returns initials from a full name (up to 2 chars). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Formats a phone number for display (E.164 → +1 (555) 234-5678). US only. */
export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7);
    return `+1 (${area}) ${prefix}-${line}`;
  }
  return e164;
}

/** Normalises a BCP 47 language tag to lowercase. */
export function normaliseLocale(tag: string): string {
  return tag.toLowerCase().trim();
}

/** Returns true if the locale requires RTL layout. */
const RTL_LOCALES = new Set(["ar", "he", "fa", "ur", "yi", "dv"]);
export function isRtl(locale: string): boolean {
  const base = normaliseLocale(locale).split("-")[0] ?? "";
  return RTL_LOCALES.has(base);
}
