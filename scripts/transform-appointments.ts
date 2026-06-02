#!/usr/bin/env tsx
/**
 * transform-appointments.ts
 *
 * Transforms Appointments2.csv (Nowsta export) into clean JSON ready for
 * seed-appointments.ts.
 *
 * Usage (from repo root):
 *   pnpm tsx scripts/transform-appointments.ts <Appointments2.csv> [output.json]
 *
 * Rules:
 *  - date_time parsed as local time (America/Los_Angeles assumed), stored as ISO.
 *  - pre_auth_amount defaults to 0 if empty.
 *  - pre_auth_mileage defaults to 0 if empty.
 *  - patient_mrn kept as-is (may be empty string → null).
 *  - interpreter_phone normalised to digits only (may be empty → null).
 *  - Rows with no patient_name are skipped with a warning.
 */

import fs   from "node:fs";
import path from "node:path";

export interface CleanAppointment {
  date_time:                string;   // ISO 8601
  duration_minutes:         number;
  appointment_type:         string;   // maps to AppointmentType.name
  language:                 string;
  interpreter_type_required: string;
  patient_name:             string;
  patient_mrn:              string | null;
  clinic_name:              string;
  agency_name:              string;
  referring_physician:      string | null;
  pre_auth_amount:          number;
  pre_auth_mileage:         number;
  po_number:                string | null;
  billing_interpreter:      string | null;
  interpreter_phone:        string | null;
}

// ─── CSV parser (handles multiline quoted fields) ────────────────────────────

function parseCSV(content: string): Record<string, string>[] {
  const records: string[][] = [];
  let current = "";
  let inQuotes = false;
  let currentRecord: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch   = content[i];
    const next = content[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      currentRecord.push(current); current = "";
    } else if ((ch === "\n" || (ch === "\r" && next === "\n")) && !inQuotes) {
      if (ch === "\r") i++;
      currentRecord.push(current); current = "";
      if (currentRecord.some(f => f !== "")) records.push(currentRecord);
      currentRecord = [];
    } else {
      current += ch;
    }
  }
  currentRecord.push(current);
  if (currentRecord.some(f => f !== "")) records.push(currentRecord);

  if (records.length < 2) return [];
  const headers = records[0].map(h => h.trim());
  return records.slice(1).map(values => {
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim(); });
    return row;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateTime(raw: string): string {
  // Parse "YYYY-MM-DD HH:MM" as America/Los_Angeles wall-clock time,
  // correctly handling both PDT (UTC-7, Mar–Nov) and PST (UTC-8, Nov–Mar).
  //
  // Strategy: try each candidate offset, then verify by formatting the
  // resulting UTC moment back through the LA timezone. The offset that
  // round-trips to the original string is the correct one.
  if (!raw) throw new Error("Empty date_time");

  for (const offset of ["-07:00", "-08:00"]) {
    const candidate = new Date(`${raw.replace(" ", "T")}:00${offset}`);

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year:     "numeric",
      month:    "2-digit",
      day:      "2-digit",
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   false,
    }).formatToParts(candidate);

    const p: Record<string, string> = {};
    parts.forEach(({ type, value }) => { p[type] = value; });
    const roundTripped = `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;

    if (roundTripped === raw) return candidate.toISOString();
  }

  throw new Error(`Cannot determine LA timezone offset for "${raw}"`);
}

function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

/**
 * Split a PO number that may contain a billing interpreter name after " - ".
 * e.g. "5287944 - Ruth"     → { po: "5287944",  billingInterpreter: "Ruth" }
 *      "14344376 - Qualified" → { po: "14344376", billingInterpreter: "Qualified" }
 *      "5287944"             → { po: "5287944",  billingInterpreter: null }
 *      ""                    → { po: null,        billingInterpreter: null }
 */
function parsePO(raw: string): { po: string | null; billingInterpreter: string | null } {
  const s = raw.trim();
  if (!s) return { po: null, billingInterpreter: null };

  // Match "anything - anything" — split on the FIRST " - " (with flexible spacing)
  const match = s.match(/^(.+?)\s+-\s+(.+)$/);
  if (match) {
    const po   = match[1].trim() || null;
    const name = match[2].trim() || null;
    return { po, billingInterpreter: name };
  }

  return { po: s, billingInterpreter: null };
}

function clean(raw: string): string | null {
  const s = raw.trim();
  return s || null;
}

// ─── Row transform ────────────────────────────────────────────────────────────

interface RowResult {
  record:   CleanAppointment | null;
  warnings: string[];
  rowNum:   number;
}

function transformRow(row: Record<string, string>, rowNum: number): RowResult {
  const warnings: string[] = [];

  const patientName = row["patient_name"]?.trim() ?? "";
  if (!patientName) {
    warnings.push("Empty patient_name — skipping row");
    return { record: null, warnings, rowNum };
  }

  const clinicName = row["clinic_name"]?.trim() ?? "";
  if (!clinicName) {
    warnings.push("Empty clinic_name — skipping row");
    return { record: null, warnings, rowNum };
  }

  const agencyName = row["insurance_agency_name"]?.trim() ?? "";
  if (!agencyName) {
    warnings.push("Empty insurance_agency_name — skipping row");
    return { record: null, warnings, rowNum };
  }

  let dateTimeIso: string;
  try {
    dateTimeIso = parseDateTime(row["date_time"] ?? "");
  } catch {
    warnings.push(`Invalid date_time "${row["date_time"]}" — skipping row`);
    return { record: null, warnings, rowNum };
  }

  const durationRaw = parseInt(row["duration_minutes"] ?? "120", 10);
  const duration    = isNaN(durationRaw) ? 120 : durationRaw;

  const preAuthAmount   = parseFloat(row["pre_auth_amount"]   || "0") || 0;
  const preAuthMileage  = parseInt(row["pre_auth_mileage"]    || "0", 10) || 0;

  const { po, billingInterpreter } = parsePO(row["po_number"] ?? "");

  const record: CleanAppointment = {
    date_time:                 dateTimeIso,
    duration_minutes:          duration,
    appointment_type:          row["appointment_type"]?.trim()          || "In-Person",
    language:                  row["language"]?.trim()                  || "es",
    interpreter_type_required: row["interpreter_type_required"]?.trim() || "Qualified",
    patient_name:              patientName,
    patient_mrn:               clean(row["patient_mrn"] ?? ""),
    clinic_name:               clinicName,
    agency_name:               agencyName,
    referring_physician:       clean(row["referring_physician"] ?? ""),
    pre_auth_amount:           preAuthAmount,
    pre_auth_mileage:          preAuthMileage,
    po_number:                 po,
    billing_interpreter:       billingInterpreter,
    interpreter_phone:         normalisePhone(row["interpreter_phone"] ?? ""),
  };

  return { record, warnings, rowNum };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, inputArg, outputArg] = process.argv;
if (!inputArg) {
  console.error("Usage: pnpm tsx scripts/transform-appointments.ts <csv> [output.json]");
  process.exit(1);
}

const inputPath  = path.resolve(inputArg);
const outputPath = outputArg
  ? path.resolve(outputArg)
  : path.join(path.dirname(inputPath), "appointments-clean.json");

const content = fs.readFileSync(inputPath, "utf-8");
const rows    = parseCSV(content);

const results: CleanAppointment[] = [];
let skipped = 0;

for (let i = 0; i < rows.length; i++) {
  const { record, warnings, rowNum } = transformRow(rows[i], i + 1);
  if (warnings.length > 0) {
    console.warn(`\n⚠  Row ${rowNum + 1}:`);
    warnings.forEach(w => console.warn(`   · ${w}`));
  }
  if (record === null) { skipped++; continue; }
  results.push(record);
}

// Summary of unique clinic/agency names to help verify lookups
const clinicNames  = [...new Set(results.map(r => r.clinic_name))].sort();
const agencyNames  = [...new Set(results.map(r => r.agency_name))].sort();

console.log(`\n── Unique clinic names (${clinicNames.length}) ──`);
clinicNames.forEach(n => console.log("  ", n));
console.log(`\n── Unique agency names (${agencyNames.length}) ──`);
agencyNames.forEach(n => console.log("  ", n));

fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");
console.log(`\n✓ Transformed ${results.length} appointment(s) → ${outputPath}`);
if (skipped > 0) console.log(`  Skipped (bad data): ${skipped}`);
