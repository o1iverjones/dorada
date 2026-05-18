import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse";
import { createReadStream } from "fs";

const prisma = new PrismaClient();
const ORG_ID = "5e7dd14a-67ca-41b3-8dee-65091c90cd3e";
const TYPE_ID = "f3b29d2b-9460-4049-8f19-d6fce3c74e1d"; // In-Person
const CSV_PATH = "/Users/macbook/Downloads/Event Overview May 7, 2026 - Jul 31, 2026.csv";

// ── Parsers ────────────────────────────────────────────────────────────────

function parseDate(raw: string): string | null {
  // "Thursday, May 7, 2026"
  const m = raw.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!m) return null;
  const months: Record<string, string> = {
    January: "01", Jan: "01", February: "02", Feb: "02",
    March: "03", Mar: "03", April: "04", Apr: "04",
    May: "05", June: "06", Jun: "06", July: "07", Jul: "07",
    August: "08", Aug: "08", September: "09", Sep: "09", Sept: "09",
    October: "10", Oct: "10", November: "11", Nov: "11",
    December: "12", Dec: "12",
  };
  const mon = months[m[1]];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[2].padStart(2, "0")}`;
}

function parseTimeRange(raw: string): { startISO: (date: string) => string; durationMinutes: number } | null {
  // "8:00 AM - 10:00 AM"  or  "9:30 AM - 11:30 PM"
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;

  function to24(h: number, min: number, ampm: string): number {
    if (ampm.toUpperCase() === "PM" && h !== 12) h += 12;
    if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
    return h * 60 + min;
  }

  const startMins = to24(parseInt(m[1]), parseInt(m[2]), m[3]);
  let endMins = to24(parseInt(m[4]), parseInt(m[5]), m[6]);
  // Handle data entry errors like "9:30 AM - 11:30 PM" (should be AM) — cap at 8 hrs
  if (endMins < startMins) endMins = startMins + 120;
  const duration = Math.min(endMins - startMins, 480);

  return {
    durationMinutes: duration,
    startISO: (date: string) => {
      const h = Math.floor(startMins / 60).toString().padStart(2, "0");
      const min = (startMins % 60).toString().padStart(2, "0");
      return `${date}T${h}:${min}:00.000Z`;
    },
  };
}

function cleanPatientName(raw: string): string {
  return raw
    .replace(/\bDOB:?\s*[\d/]+/gi, "")
    .replace(/\bCaso\s+\d+.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function mapStatus(department: string): string {
  const d = department.trim().toLowerCase();
  if (d === "billed") return "completed";
  if (d === "approved") return "confirmed";
  return "confirmed";
}

// ── Find-or-create helpers ─────────────────────────────────────────────────

const clinicCache = new Map<string, string>();
async function findOrCreateClinic(name: string, address: string): Promise<string> {
  const key = name.trim().toLowerCase();
  if (clinicCache.has(key)) return clinicCache.get(key)!;
  const existing = await prisma.clinic.findFirst({
    where: { organization_id: ORG_ID, name: { equals: name.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) { clinicCache.set(key, existing.id); return existing.id; }
  const created = await prisma.clinic.create({
    data: { organization_id: ORG_ID, name: name.trim(), address: address.trim() || null, billing_model: "hourly" },
    select: { id: true },
  });
  clinicCache.set(key, created.id);
  return created.id;
}

const agencyCache = new Map<string, string>();
async function findOrCreateAgency(name: string): Promise<string> {
  const key = name.trim().toLowerCase();
  if (agencyCache.has(key)) return agencyCache.get(key)!;
  const existing = await prisma.insuranceAgency.findFirst({
    where: { organization_id: ORG_ID, name: { equals: name.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) { agencyCache.set(key, existing.id); return existing.id; }
  const created = await prisma.insuranceAgency.create({
    data: { organization_id: ORG_ID, name: name.trim() },
    select: { id: true },
  });
  agencyCache.set(key, created.id);
  return created.id;
}

const patientCache = new Map<string, string>();
async function findOrCreatePatient(rawName: string): Promise<string> {
  const name = cleanPatientName(rawName);
  const key = name.toLowerCase();
  if (patientCache.has(key)) return patientCache.get(key)!;
  const existing = await prisma.patient.findFirst({
    where: { organization_id: ORG_ID, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) { patientCache.set(key, existing.id); return existing.id; }
  const created = await prisma.patient.create({
    data: { organization_id: ORG_ID, name },
    select: { id: true },
  });
  patientCache.set(key, created.id);
  return created.id;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const records: Record<string, string>[] = [];

  await new Promise<void>((resolve, reject) => {
    createReadStream(CSV_PATH)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }))
      .on("data", (row) => records.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(`Parsed ${records.length} rows`);

  let created = 0;
  let skipped = 0;

  for (const row of records) {
    const date = parseDate(row["Date"] ?? "");
    if (!date) { skipped++; continue; }

    const timeRange = parseTimeRange(row["Event Time"] ?? "");
    if (!timeRange) { skipped++; continue; }

    const venueName = (row["Venue"] ?? "").trim();
    const clientName = (row["Client"] ?? "").trim();
    const patientRaw = (row["Name"] ?? "").trim();
    if (!venueName || !clientName || !patientRaw) { skipped++; continue; }

    try {
      const [clinicId, agencyId, patientId] = await Promise.all([
        findOrCreateClinic(venueName, row["Address"] ?? ""),
        findOrCreateAgency(clientName),
        findOrCreatePatient(patientRaw),
      ]);

      await prisma.appointment.create({
        data: {
          organization_id: ORG_ID,
          type_id: TYPE_ID,
          clinic_id: clinicId,
          insurance_agency_id: agencyId,
          patient_id: patientId,
          language: "Spanish",
          interpreter_type_required: "qualified",
          status: mapStatus(row["Department"] ?? ""),
          date_time: new Date(timeRange.startISO(date)),
          duration_minutes: timeRange.durationMinutes,
          pre_auth_amount: 0,
          pre_auth_mileage: 0,
        },
      });
      created++;
    } catch (err) {
      console.error(`Skipped row (${patientRaw} on ${date}):`, (err as Error).message);
      skipped++;
    }
  }

  console.log(`Done — created: ${created}, skipped: ${skipped}`);
}

main().finally(() => prisma.$disconnect());
