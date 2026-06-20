/** Returns [startUtc, endUtc] spanning midnight-to-midnight for dateStr ("YYYY-MM-DD") in the given IANA timezone. */
export function dateBoundsInTz(dateStr: string, tz: string): [Date, Date] {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Use noon UTC as a DST-safe reference to determine the UTC offset on that date
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(noonUtc);
  const localH = parseInt(parts.find((p) => p.type === "hour")?.value ?? "12", 10);
  const localM = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const offsetMinutes = 12 * 60 - (localH * 60 + localM);
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) + offsetMinutes * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
  return [startUtc, endUtc];
}
