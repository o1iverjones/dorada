/**
 * Locale-aware date/time formatting utilities built on the native Intl API.
 * No external library required.
 */

export type DateTimeStyle = "full" | "long" | "medium" | "short";

export interface FormatDateTimeOptions {
  locale?: string;
  dateStyle?: DateTimeStyle;
  timeStyle?: DateTimeStyle;
  timeZone?: string;
}

export function formatDateTime(
  isoString: string,
  options: FormatDateTimeOptions = {},
): string {
  const { locale = "en", dateStyle = "medium", timeStyle = "short", timeZone } = options;
  return new Intl.DateTimeFormat(locale, {
    dateStyle,
    timeStyle,
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(isoString));
}

export function formatDate(
  isoString: string,
  options: Omit<FormatDateTimeOptions, "timeStyle"> = {},
): string {
  const { locale = "en", dateStyle = "medium", timeZone } = options;
  return new Intl.DateTimeFormat(locale, {
    dateStyle,
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(isoString));
}

export function formatTime(
  isoString: string,
  options: Omit<FormatDateTimeOptions, "dateStyle"> = {},
): string {
  const { locale = "en", timeStyle = "short", timeZone } = options;
  return new Intl.DateTimeFormat(locale, {
    timeStyle,
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(isoString));
}

export function formatCurrency(amount: number, locale = "en", currency = "USD"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

export function formatDurationMinutes(minutes: number, locale = "en"): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) {
    return new Intl.RelativeTimeFormat(locale).formatToParts(mins, "minute").map(p => p.value).join("");
  }
  const hLabel = hours === 1 ? "hr" : "hrs";
  if (mins === 0) return `${hours} ${hLabel}`;
  return `${hours} ${hLabel} ${mins} min`;
}

/** Returns true if date A is strictly before date B. */
export function isBefore(a: string, b: string): boolean {
  return new Date(a) < new Date(b);
}

/** Adds the given number of minutes to an ISO datetime string. */
export function addMinutes(isoString: string, minutes: number): string {
  return new Date(new Date(isoString).getTime() + minutes * 60_000).toISOString();
}

/** Returns the difference in minutes between two ISO datetime strings (b - a). */
export function diffMinutes(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
}
