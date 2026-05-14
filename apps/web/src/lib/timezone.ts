/** Format a date/string in a specific IANA timezone. */
export function formatInTz(
  date: Date | string,
  options: Intl.DateTimeFormatOptions,
  tz: string,
): string {
  return new Date(date).toLocaleString([], { ...options, timeZone: tz });
}

/** Convert a UTC ISO string to "YYYY-MM-DDTHH:MM" in the given timezone (for datetime-local inputs). */
export function toTzDateTimeInput(iso: string, tz: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/**
 * Convert a "YYYY-MM-DDTHH:MM" string that the user entered (interpreted as a time
 * in `tz`) back to a UTC ISO string.
 */
export function fromTzDateTimeInput(localStr: string, tz: string): string {
  // Parse as if UTC, then measure the offset the timezone applies at that moment.
  const naive = new Date(localStr + ":00.000Z");
  const tzStr = toTzDateTimeInput(naive.toISOString(), tz);
  const offsetMs = naive.getTime() - new Date(tzStr + ":00.000Z").getTime();
  return new Date(naive.getTime() + offsetMs).toISOString();
}
