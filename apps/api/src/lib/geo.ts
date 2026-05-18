/**
 * Given a YYYY-MM-DD date string representing a local calendar date in `tz`,
 * returns the UTC start (00:00:00) and end (23:59:59) of that day as Date objects.
 *
 * Example: localDayToUtcRange("2026-05-14", "America/Los_Angeles")
 *   → { gte: 2026-05-14T07:00:00Z, lte: 2026-05-15T06:59:59Z }  (PDT = UTC-7)
 */
export function localDayToUtcRange(dateStr: string, tz: string): { gte: Date; lte: Date } {
  // Probe UTC midnight of the given date, then see what local time that is.
  const utcMidnight = new Date(`${dateStr}T00:00:00Z`);

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(fmt.formatToParts(utcMidnight).map((p) => [p.type, p.value]));
  const localDate = `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
  const h = parseInt(parts["hour"] ?? "0") % 24;
  const m = parseInt(parts["minute"] ?? "0");
  const s = parseInt(parts["second"] ?? "0");

  let offsetMs: number;
  if (localDate === dateStr) {
    // Tz is ahead of UTC — UTC midnight already lands on the target date locally.
    // Local midnight is h:m:s BEFORE UTC midnight.
    offsetMs = -(h * 3600 + m * 60 + s) * 1000;
  } else {
    // Tz is behind UTC — UTC midnight is still the previous local day.
    // Local midnight is (24h - h:m:s) AFTER UTC midnight.
    offsetMs = (24 * 3600 - h * 3600 - m * 60 - s) * 1000;
  }

  const gte = new Date(utcMidnight.getTime() + offsetMs);
  const lte = new Date(gte.getTime() + 24 * 60 * 60 * 1000 - 1000);
  return { gte, lte };
}

const EARTH_RADIUS_MILES = 3958.8;

/** Haversine distance between two lat/lng points, in miles. */
export function distanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(a));
}

async function nominatimSearch(q: string): Promise<[number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Dorada/1.0 (scheduling platform)" } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length || !data[0]) return null;
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

/**
 * Geocode a free-text address using OpenStreetMap Nominatim (no API key required).
 * Tries progressively simplified forms of the address to handle suite numbers,
 * duplicate tokens, and country suffixes that confuse the geocoder.
 * Returns [lat, lng] or null if not found / request fails.
 */
export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const normalised = address.replace(/,\s*,/g, ",").replace(/\s+/g, " ").trim();
    const noCountry = normalised.replace(/,\s*US[A]?\s*$/i, "").trim();
    const noSuite = noCountry
      .replace(/,?\s*(suite|ste\.?|unit|#|apt\.?|building|bldg\.?|floor|fl\.?)\s*[\w-]+/gi, "")
      .replace(/,\s*,/g, ",")
      .trim();
    const parts = noSuite.split(",").map((p) => p.trim()).filter(Boolean);
    const minimal = parts.slice(0, 3).join(", ");

    for (const q of [...new Set([noSuite, noCountry, minimal, normalised])]) {
      const result = await nominatimSearch(q);
      if (result) return result;
    }
    return null;
  } catch {
    return null;
  }
}
