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
  const res = await fetch(url, { headers: { "User-Agent": "Pulpito/1.0 (scheduling platform)" } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
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
