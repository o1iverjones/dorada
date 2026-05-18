/**
 * One-time backfill: geocode clinic addresses using Nominatim and store lat/lng.
 * Run with: npx tsx scripts/geocode-clinics.ts
 *
 * Nominatim's usage policy requires <= 1 request/second, so we add a 1.1s delay
 * between each request. With ~50 clinics this takes ~1 minute.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function nominatim(q: string): Promise<[number, number] | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Dorada/1.0 (scheduling platform)" } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

/**
 * Try several progressively simpler versions of an address.
 * The raw DB addresses often contain: "Street, Suite X, City, State, ZIP, Country"
 * Nominatim works best with: "Street, City, State ZIP"
 */
async function geocode(raw: string): Promise<[number, number] | null> {
  // Normalise: collapse extra spaces/commas
  const clean = raw.replace(/,\s*,/g, ",").replace(/\s+/g, " ").trim();

  // Remove trailing ", US" or ", USA"
  const noCountry = clean.replace(/,\s*US[A]?\s*$/i, "").trim();

  // Strip suite/unit qualifiers: "SUITE B", "STE 200", "STE. 10", "# 4", "APT 1"
  const noSuite = noCountry
    .replace(/,?\s*(suite|ste\.?|unit|#|apt\.?)\s*[\w-]+/gi, "")
    .replace(/,\s*,/g, ",")
    .trim();

  // Build a minimal "street, city, state zip" from remaining parts
  const parts = noSuite.split(",").map((p) => p.trim()).filter(Boolean);
  const minimal = parts.slice(0, 3).join(", "); // street, city, state

  const candidates = [noSuite, noCountry, minimal, clean];
  const unique = [...new Set(candidates)].filter(Boolean);

  for (const q of unique) {
    const result = await nominatim(q);
    if (result) return result;
    await sleep(1100); // rate limit between retries
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const clinics = await prisma.clinic.findMany({
    where: {
      address: { not: null },
      location_lat: null,
    },
    select: { id: true, name: true, address: true },
  });

  console.log(`Geocoding ${clinics.length} clinics…`);

  let ok = 0;
  let failed = 0;

  for (const clinic of clinics) {
    process.stdout.write(`  ${clinic.name} … `);
    const coords = await geocode(clinic.address!);
    if (coords) {
      await prisma.clinic.update({
        where: { id: clinic.id },
        data: { location_lat: coords[0], location_lng: coords[1] },
      });
      console.log(`✓ ${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`);
      ok++;
    } else {
      console.log("✗ not found");
      failed++;
    }
    // Respect Nominatim rate limit (1 req/sec)
    await sleep(1100);
  }

  console.log(`\nDone. ${ok} geocoded, ${failed} failed.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
