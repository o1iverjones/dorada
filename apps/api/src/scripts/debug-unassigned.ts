import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse";
import { createReadStream } from "fs";

const prisma = new PrismaClient();
const ORG_ID = "5e7dd14a-67ca-41b3-8dee-65091c90cd3e";
const CSV_PATH = "/Users/macbook/Downloads/Event Overview May 7, 2026 - Jul 31, 2026.csv";

const pad = (n: number) => String(n).padStart(2, "0");

function parseDate(raw: string): string | null {
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

function parseStartTime(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${pad(h)}:${pad(min)}`;
}

function parseInterpreterName(shift1: string): string | null {
  const lines = shift1.split("\n").map(l => l.trim()).filter(Boolean);
  const nameLine = lines[1];
  if (!nameLine) return null;
  const dashIdx = nameLine.lastIndexOf(" - ");
  if (dashIdx === -1) return nameLine.trim();
  return nameLine.slice(0, dashIdx).trim();
}

function cleanPatientName(raw: string): string {
  return raw
    .replace(/\bDOB:?\s*[\d/]+/gi, "")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "")
    .replace(/\bCaso\s+\d+.*$/i, "")
    .replace(/\([A-Z0-9]{5,}\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[-:]+\s*$/, "")
    .trim();
}

async function main() {
  const records: Record<string, string>[] = [];
  await new Promise<void>((res, rej) => {
    createReadStream(CSV_PATH)
      .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }))
      .on("data", r => records.push(r))
      .on("end", res).on("error", rej);
  });

  const interpreters = await prisma.interpreter.findMany({ where: { organization_id: ORG_ID }, select: { id: true, name: true } });
  const interpByName = new Map(interpreters.map(i => [i.name.toLowerCase().trim(), i.id]));

  // Count unassigned in DB
  const unassigned = await prisma.appointment.count({ where: { organization_id: ORG_ID, interpreter_id: null } });
  console.log(`Unassigned in DB: ${unassigned}`);

  // Walk CSV rows that have a valid interpreter and diagnose why they didn't match
  let diagnosed = 0;
  for (const row of records) {
    const shift1 = (row["Shift 1"] ?? "").trim();
    if (!shift1) continue;
    const interpName = parseInterpreterName(shift1);
    if (!interpName) continue;
    const interpreterId = interpByName.get(interpName.toLowerCase().trim());
    if (!interpreterId) continue; // skip unknown names

    const date = parseDate(row["Date"] ?? "");
    if (!date) continue;
    const startTime = parseStartTime(row["Event Time"] ?? "");
    if (!startTime) continue;
    const patientName = cleanPatientName(row["Name"] ?? "");
    if (!patientName) continue;

    const dateStart = new Date(`${date}T00:00:00.000Z`);
    const dateEnd   = new Date(`${date}T23:59:59.999Z`);

    const patient = await prisma.patient.findFirst({
      where: { organization_id: ORG_ID, name: { equals: patientName, mode: "insensitive" } },
      select: { id: true },
    });

    if (!patient) {
      if (diagnosed < 20) console.log(`NO PATIENT: "${patientName}" (raw: "${row["Name"]}")`);
      diagnosed++;
      continue;
    }

    const appts = await prisma.appointment.findMany({
      where: { organization_id: ORG_ID, patient_id: patient.id, date_time: { gte: dateStart, lte: dateEnd } },
      select: { id: true, date_time: true, interpreter_id: true },
    });

    const [h, min] = startTime.split(":").map(Number);
    const appt = appts.find(a => {
      const d = new Date(a.date_time);
      return d.getUTCHours() === h && d.getUTCMinutes() === min;
    });

    if (!appt) {
      if (diagnosed < 20) {
        const times = appts.map(a => {
          const d = new Date(a.date_time);
          return `${d.getUTCHours()}:${pad(d.getUTCMinutes())}`;
        });
        console.log(`NO TIME MATCH: "${patientName}" on ${date}, want ${startTime}, found times: [${times.join(", ")}]`);
      }
      diagnosed++;
    }
  }
  console.log(`\nTotal unmatched rows diagnosed: ${diagnosed}`);
}

main().finally(() => prisma.$disconnect());
