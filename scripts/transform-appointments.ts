#!/usr/bin/env tsx
/**
 * transform-appointments.ts
 *
 * Transforms a Nowsta CSV export into clean JSON ready for seed-appointments.ts.
 * Supports two Nowsta export formats auto-detected from the header row:
 *
 *  Format A (old structured export):
 *    Headers: date_time, duration_minutes, appointment_type, language, ...
 *    date_time is "YYYY-MM-DD HH:MM" in America/Los_Angeles local time.
 *
 *  Format B (Events Overview export):
 *    Headers: Date, Name, Event ID, Department, Venue, Client, Event Time, ...
 *    Date is "Weekday, Mon D, YYYY", Event Time is "H:MM AM - H:MM AM".
 *
 * Usage (from repo root):
 *   pnpm tsx scripts/transform-appointments.ts <export.csv> [output.json]
 *
 * Rules:
 *  - date_time parsed as local time (America/Los_Angeles), stored as ISO.
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
  interpreter_name:         string | null;  // used when phone is unavailable (Format B)
  admin_notes:              string | null;  // imported from Nowsta "Admin Notes" field
  billing_payment_status:   "paid" | "not_paid";
  billing_approval_status:  "approved" | "pending_approval";
  billing_billed:           boolean;
  billing_invoiced:         boolean;
  billing_payment_under_claim: boolean;
  billing_retro:            boolean;
  patient_dob:              string | null;  // ISO "YYYY-MM-DD", extracted from patient name
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

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Parse "YYYY-MM-DD HH:MM" as America/Los_Angeles wall-clock time.
 * Uses round-trip DST verification to pick the correct PDT/PST offset.
 */
function parseDateTime(raw: string): string {
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
 * e.g. "5287944 - Ruth"       → { po: "5287944",  billingInterpreter: "Ruth" }
 *      "14344376 - Qualified" → { po: "14344376", billingInterpreter: "Qualified" }
 *      "5287944"              → { po: "5287944",  billingInterpreter: null }
 *      ""                     → { po: null,        billingInterpreter: null }
 */
function parsePO(raw: string): { po: string | null; billingInterpreter: string | null } {
  const s = raw.trim();
  if (!s) return { po: null, billingInterpreter: null };

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

/**
 * Extract a date of birth from a patient name string and return the cleaned
 * name alongside the parsed DOB (ISO "YYYY-MM-DD").
 *
 * Handles:
 *  "John Doe - DOB: 01/23/1945"   → name: "John Doe",  dob: "1945-01-23"
 *  "John Doe DOB 1/23/45"         → name: "John Doe",  dob: "1945-01-23"
 *  "John Doe 01/23/1945"          → name: "John Doe",  dob: "1945-01-23"
 *  "John Doe 01-23-1945"          → name: "John Doe",  dob: "1945-01-23"
 *  "John Doe 1945-01-23"          → name: "John Doe",  dob: "1945-01-23"
 *  "John Doe 01/23/1945 - Note"   → name: "John Doe",  dob: "1945-01-23"
 */
function extractDOB(raw: string): { name: string; dob: string | null } {
  // Pattern 1: explicit DOB label (optional leading dash/space)
  const dobLabel = /\s*[-–]?\s*\bDOB:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
  // Pattern 2: ISO date YYYY-MM-DD
  const isoDate  = /\s+(\d{4}-\d{2}-\d{2})(?:\s|$)/;
  // Pattern 3: bare MM/DD/YYYY or MM-DD-YYYY (4-digit year only to avoid false positives)
  const bareDate = /\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})(?:\s|$)/;

  let dateStr: string | null = null;
  let matchIndex = -1;

  for (const re of [dobLabel, isoDate, bareDate]) {
    const m = raw.match(re);
    if (m) { dateStr = m[1]; matchIndex = m.index!; break; }
  }

  if (!dateStr || matchIndex === -1) return { name: raw.trim(), dob: null };

  // Everything before the match is the clean name
  const name = raw.slice(0, matchIndex).trim().replace(/\s*[-–]\s*$/, "").trim() || raw.trim();

  // Parse the date
  let yyyy: number, mm: number, dd: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    [yyyy, mm, dd] = dateStr.split("-").map(Number);
  } else {
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length !== 3) return { name: raw.trim(), dob: null };
    [mm, dd, yyyy] = parts.map(Number);
    if (yyyy < 100) yyyy = yyyy < 30 ? 2000 + yyyy : 1900 + yyyy;
  }

  // Basic sanity check
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > new Date().getFullYear()) {
    return { name: raw.trim(), dob: null };
  }

  return {
    name,
    dob: `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
  };
}

interface BillingStatus {
  billing_payment_status:      "paid" | "not_paid";
  billing_approval_status:     "approved" | "pending_approval";
  billing_billed:              boolean;
  billing_invoiced:            boolean;
  billing_payment_under_claim: boolean;
  billing_retro:               boolean;
}

/**
 * Parse the Nowsta "Department" field into Dorada billing flags.
 * Possible values: Paid, Not Paid, Approved, Billed, INVOICE, Payment under claim, Retro
 */
function parseBilling(department: string): BillingStatus {
  const d = department.trim().toLowerCase();
  return {
    billing_payment_status:      d === "paid" ? "paid" : "not_paid",
    billing_approval_status:     d === "approved" ? "approved" : "pending_approval",
    billing_billed:              d === "billed" || d === "paid",
    billing_invoiced:            d === "invoice" || d === "paid",
    billing_payment_under_claim: d === "payment under claim",
    billing_retro:               d === "retro",
  };
}

/**
 * Extract the interpreter's full name from the "Shift 1" field.
 * The field looks like:
 *   "Interpreter normal: 9:00 AM - 11:00 AM\nMaria de Franco - Confirmed\n"
 * We find the line matching "<Name> - <Status>" and return the name part.
 */
function parseInterpreterFromShift(shift: string): string | null {
  const STATUSES = /^(Confirmed|Requested|Declined|No Show|Cancelled|Pending)$/i;
  for (const line of shift.split("\n")) {
    const trimmed = line.trim();
    const dashIdx = trimmed.lastIndexOf(" - ");
    if (dashIdx === -1) continue;
    const namePart   = trimmed.slice(0, dashIdx).trim();
    const statusPart = trimmed.slice(dashIdx + 3).trim();
    if (namePart && STATUSES.test(statusPart)) return namePart;
  }
  return null;
}

// ─── Format B helpers ─────────────────────────────────────────────────────────

/**
 * Parse "Tuesday, Mar 3, 2026" → "2026-03-03"
 */
function parseDateB(raw: string): string {
  // Strip leading weekday e.g. "Tuesday, " then parse the rest
  const withoutDay = raw.replace(/^[^,]+,\s*/, "").trim(); // "Mar 3, 2026"
  const d = new Date(withoutDay);
  if (isNaN(d.getTime())) throw new Error(`Cannot parse date "${raw}"`);
  // Use UTC values since new Date("Mar 3, 2026") parses as midnight UTC
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse "8:40 AM" → { hours: 8, minutes: 40 } (24-hour)
 */
function parseTime12(raw: string): { hours: number; minutes: number } {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) throw new Error(`Cannot parse time "${raw}"`);
  let hours   = parseInt(match[1], 10);
  const mins  = parseInt(match[2], 10);
  const ampm  = match[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  return { hours, minutes: mins };
}

/**
 * Parse "8:40 AM - 10:40 AM" → { dateTimeRaw: "YYYY-MM-DD HH:MM", durationMinutes: number }
 */
function parseEventTime(dateStr: string, eventTime: string): { dateTimeRaw: string; durationMinutes: number } {
  const parts = eventTime.split(" - ");
  if (parts.length < 2) throw new Error(`Cannot parse event time "${eventTime}"`);

  const start = parseTime12(parts[0]);
  const end   = parseTime12(parts[1]);

  const hh = String(start.hours).padStart(2, "0");
  const mm = String(start.minutes).padStart(2, "0");
  const dateTimeRaw = `${dateStr} ${hh}:${mm}`;

  let durationMinutes = (end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
  if (durationMinutes <= 0) durationMinutes += 24 * 60; // handle crossing midnight
  if (durationMinutes <= 0 || durationMinutes > 480) durationMinutes = 120; // sanity default

  return { dateTimeRaw, durationMinutes };
}

// ─── Row transforms ───────────────────────────────────────────────────────────

interface RowResult {
  record:   CleanAppointment | null;
  warnings: string[];
  rowNum:   number;
}

/** Format A: structured export with date_time, patient_name, clinic_name columns */
function transformRowA(row: Record<string, string>, rowNum: number): RowResult {
  const warnings: string[] = [];

  const rawPatientName = row["patient_name"]?.trim() ?? "";
  if (!rawPatientName) {
    warnings.push("Empty patient_name — skipping row");
    return { record: null, warnings, rowNum };
  }
  const { name: patientName, dob: patientDob } = extractDOB(rawPatientName);

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

  const preAuthAmount  = parseFloat(row["pre_auth_amount"]  || "0") || 0;
  const preAuthMileage = parseInt(row["pre_auth_mileage"]   || "0", 10) || 0;

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
    interpreter_name:          null,
    admin_notes:               null,
    billing_payment_status:    "not_paid",
    billing_approval_status:   "pending_approval",
    billing_billed:            false,
    billing_invoiced:          false,
    billing_payment_under_claim: false,
    billing_retro:             false,
    patient_dob:               patientDob,
  };

  return { record, warnings, rowNum };
}

/** Format B: Events Overview export with Date, Name, Venue, Client, Event Time columns */
function transformRowB(row: Record<string, string>, rowNum: number): RowResult {
  const warnings: string[] = [];

  const rawPatientName = row["Name"]?.trim() ?? "";
  if (!rawPatientName) {
    warnings.push("Empty Name — skipping row");
    return { record: null, warnings, rowNum };
  }
  const { name: patientName, dob: patientDob } = extractDOB(rawPatientName);

  const clinicName = row["Venue"]?.trim() ?? "";
  if (!clinicName) {
    warnings.push("Empty Venue — skipping row");
    return { record: null, warnings, rowNum };
  }

  const agencyName = row["Client"]?.trim() ?? "";
  if (!agencyName) {
    warnings.push("Empty Client — skipping row");
    return { record: null, warnings, rowNum };
  }

  const rawDate      = row["Date"]?.trim() ?? "";
  const rawEventTime = row["Event Time"]?.trim() ?? "";

  let dateTimeIso: string;
  let durationMinutes = 120;
  try {
    const dateStr = parseDateB(rawDate);
    const { dateTimeRaw, durationMinutes: dur } = parseEventTime(dateStr, rawEventTime);
    durationMinutes = dur;
    dateTimeIso = parseDateTime(dateTimeRaw);
  } catch (e) {
    warnings.push(`Invalid date/time "${rawDate} ${rawEventTime}" — skipping row`);
    return { record: null, warnings, rowNum };
  }

  // Event ID is the PO number in format B
  const { po, billingInterpreter } = parsePO(row["Event ID"] ?? "");

  // Extract interpreter name from the "Shift 1" field
  const interpreterName = parseInterpreterFromShift(row["Shift 1"] ?? "");

  // Parse billing status from the "Department" field
  const billing = parseBilling(row["Department"] ?? "");

  // Clean up admin notes: collapse excessive blank lines, trim, truncate to 800 chars
  const rawNotes = (row["Admin Notes"] ?? "").trim();
  const adminNotes = rawNotes
    ? rawNotes.replace(/\n{3,}/g, "\n\n").slice(0, 800) || null
    : null;

  const record: CleanAppointment = {
    date_time:                 dateTimeIso,
    duration_minutes:          durationMinutes,
    appointment_type:          "In-Person",
    language:                  "es",
    interpreter_type_required: "Qualified",
    patient_name:              patientName,
    patient_mrn:               null,
    clinic_name:               clinicName,
    agency_name:               agencyName,
    referring_physician:       null,
    pre_auth_amount:           0,
    pre_auth_mileage:          0,
    po_number:                 po,
    billing_interpreter:       billingInterpreter,
    interpreter_phone:         null,
    interpreter_name:          interpreterName,
    admin_notes:               adminNotes,
    patient_dob:               patientDob,
    ...billing,
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

// Auto-detect format from headers
const firstRowKeys = Object.keys(rows[0] ?? {});
const isFormatB = firstRowKeys.includes("Date") && firstRowKeys.includes("Event Time");
console.log(`Detected format: ${isFormatB ? "B (Events Overview)" : "A (Structured export)"}`);
console.log(`Loaded ${rows.length} row(s)`);

const transformRow = isFormatB ? transformRowB : transformRowA;

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
