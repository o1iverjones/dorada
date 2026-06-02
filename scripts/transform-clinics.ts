#!/usr/bin/env tsx
/**
 * transform-clinics.ts
 *
 * Transforms a raw Nowsta locations CSV export into clean clinic JSON
 * ready for DB import via seed-clinics.ts.
 *
 * Usage:
 *   cd /path/to/Dev
 *   pnpm tsx scripts/transform-clinics.ts <input.csv> [output.json]
 *
 * Output defaults to <input-dir>/clinics-clean.json
 *
 * Rules applied:
 *  - Archived records (Archived At is non-empty) are skipped entirely.
 *  - State variants normalised: California / cal / ca → CA
 *  - Trailing commas / spaces stripped from Address1, City, Zip.
 *  - Address1 + Address2 kept as separate address / address_line2 fields.
 *  - Lat/Lng parsed from "(lat,lng)" string.
 *  - Contact phone normalised to digits only.
 *  - Concentra-style zip/state swaps detected and warned.
 *  - Records whose Name contains the address (Address1 empty, digits in Name)
 *    are parsed: name is extracted before the first address-like token.
 *  - billing_model defaults to "flat_rate" for all records.
 */

import fs   from "node:fs";
import path from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CleanClinic {
  name:                  string;
  address:               string | null;
  address_line2:         string | null;
  city:                  string | null;
  state:                 string | null;
  zip_code:              string | null;
  location_lat:          number | null;
  location_lng:          number | null;
  parking:               string | null;
  parking_instructions:  string | null;
  phone:                 string | null;
  primary_contact_name:  string | null;
  primary_contact_phone: string | null;
  primary_contact_email: string | null;
  billing_model:         string;
  is_active:             boolean;
}

interface RowWithWarnings extends CleanClinic {
  _warnings: string[];
  _source_id: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATE_MAP: Record<string, string> = {
  California:  "CA",
  california:  "CA",
  Cal:         "CA",
  cal:         "CA",
  ca:          "CA",
};

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current  = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? "").trim(); });
    rows.push(row);
  }
  return rows;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseState(raw: string): string | null {
  if (!raw) return null;
  return STATE_MAP[raw.trim()] ?? raw.trim().toUpperCase();
}

function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

function cleanText(raw: string): string | null {
  const s = raw.replace(/,+$/, "").trim();
  return s || null;
}

function parseLatLng(raw: string): [number, number] | null {
  const m = raw.match(/\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return [lat, lng];
}

function normaliseZip(raw: string): string | null {
  const s = raw.replace(/[^0-9]/g, "");
  if (s.length === 5) return s;
  if (s.length === 9) return s.slice(0, 5); // strip zip+4 if ever present
  if (s.length === 4) return null; // too short, discard
  return s.slice(0, 5) || null;
}

/**
 * For records where the entire address was entered in the Name field
 * (e.g. "Salinas Surgery Center - 955 A Blanco Circle, Salinas, CA 93901")
 * try to split into a human-readable name + address components.
 *
 * Pattern: <Name part> - <number> <street...>, <city>, <state> <zip>
 * or just <number> <street...>, <city>
 */
interface ParsedNameAddr {
  name:     string;
  address:  string | null;
  city:     string | null;
  state:    string | null;
  zip_code: string | null;
}

function parseNameAsAddress(raw: string): ParsedNameAddr {
  // Try: "Facility Name - 123 Some St, City, CA 12345"
  const dashMatch = raw.match(/^(.+?)\s+-\s+(\d+.+)/);
  if (dashMatch) {
    const clinicName = dashMatch[1].trim();
    const addrPart   = dashMatch[2].trim();
    return parseAddressPart(clinicName, addrPart);
  }

  // Try: "123 Some St, City" (starts with number — no facility name)
  const numMatch = raw.match(/^(\d+.+)/);
  if (numMatch) {
    return parseAddressPart(raw, raw);
  }

  return { name: raw, address: null, city: null, state: null, zip_code: null };
}

function parseAddressPart(name: string, addrRaw: string): ParsedNameAddr {
  // Split by commas: [street, city?, state+zip?]
  const parts = addrRaw.split(",").map((p) => p.trim()).filter(Boolean);
  const address  = parts[0] ?? null;
  const city     = parts[1] ?? null;

  let state: string | null = null;
  let zip_code: string | null = null;

  if (parts[2]) {
    // "CA 93901" or "California 93901"
    const stateZip = parts[2].trim().split(/\s+/);
    state    = normaliseState(stateZip[0] ?? "");
    zip_code = normaliseZip(stateZip[1] ?? "");
  }

  return { name, address, city, state, zip_code };
}

// ─── Row transform ────────────────────────────────────────────────────────────

function transformRow(row: Record<string, string>): RowWithWarnings | null {
  const warnings: string[] = [];

  // Skip archived records
  if (row["Archived At"]?.trim()) return null;

  // ── Name ──────────────────────────────────────────────────────────────────
  let name     = row["Name"]?.trim() ?? "";
  let address  = cleanText(row["Address1"] ?? "");
  let address2 = cleanText(row["Address2"] ?? "");
  let city     = cleanText((row["City"] ?? "").replace(/,+$/, ""));
  let state    = normaliseState(row["State"]?.trim() ?? "");
  let zip_code = normaliseZip(row["Zip"] ?? "");

  // ── Address-in-name records ────────────────────────────────────────────────
  if (!address && !city && /\d/.test(name)) {
    warnings.push(`Address embedded in Name field — attempted parse of: "${name}"`);
    const parsed = parseNameAsAddress(name);
    name     = parsed.name;
    address  = parsed.address;
    city     = parsed.city;
    state    = parsed.state    ?? state;
    zip_code = parsed.zip_code ?? zip_code;
  }

  // ── Detect swapped state / zip (e.g. State="95051" Zip="CA") ──────────────
  if (state && /^\d{5}$/.test(state) && zip_code === null) {
    warnings.push(`State and Zip appear swapped (State="${state}", Zip="${row["Zip"]}") — correcting`);
    zip_code = state;
    state    = normaliseState(row["Zip"]?.trim() ?? "");
  }

  // ── Fix "CA 95134" stored in Zip ──────────────────────────────────────────
  if (zip_code === null && /^[A-Za-z]{2}\s+\d{5}/.test(row["Zip"] ?? "")) {
    const m = (row["Zip"] ?? "").match(/([A-Za-z]{2})\s+(\d{5})/);
    if (m) {
      state    = m[1].toUpperCase();
      zip_code = m[2];
      warnings.push(`State+zip in Zip field ("${row["Zip"]}") — extracted state=${state} zip=${zip_code}`);
    }
  }

  // ── Lat/Lng ───────────────────────────────────────────────────────────────
  const latLng = parseLatLng(row["Lat Long"] ?? "");

  // ── Parking ───────────────────────────────────────────────────────────────
  const parking              = row["Parking Type"]?.trim()         || null;
  const parking_instructions = row["Parking Instructions"]?.trim() || null;

  // ── Contact ───────────────────────────────────────────────────────────────
  const primary_contact_name  = row["Contact Full Name"]?.trim()       || null;
  const primary_contact_email = row["Contact Email"]?.trim()           || null;
  const primary_contact_phone = normalisePhone(row["Contact Phone Number"] ?? "");

  // No usable clinic-level phone in source data — contact phone goes to primary_contact_phone
  const phone: string | null = null;

  return {
    _source_id:  row["Id"],
    _warnings:   warnings,
    name,
    address,
    address_line2: address2,
    city,
    state,
    zip_code,
    location_lat:  latLng?.[0] ?? null,
    location_lng:  latLng?.[1] ?? null,
    parking,
    parking_instructions,
    phone,
    primary_contact_name,
    primary_contact_phone,
    primary_contact_email,
    billing_model: "flat_rate",
    is_active:     true,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, inputArg, outputArg] = process.argv;

if (!inputArg) {
  console.error("Usage: pnpm tsx scripts/transform-clinics.ts <input.csv> [output.json]");
  process.exit(1);
}

const inputPath  = path.resolve(inputArg);
const outputPath = outputArg
  ? path.resolve(outputArg)
  : path.join(path.dirname(inputPath), "clinics-clean.json");

const content = fs.readFileSync(inputPath, "utf-8");
const rows    = parseCSV(content);

let skippedArchived = 0;
const results: RowWithWarnings[] = [];

for (const row of rows) {
  const result = transformRow(row);
  if (result === null) { skippedArchived++; continue; }
  results.push(result);
}

// ── Print warnings ────────────────────────────────────────────────────────────
let warned = 0;
results.forEach((r, i) => {
  if (r._warnings.length === 0) return;
  warned++;
  console.warn(`\n⚠  Row ${i + 1} (ID ${r._source_id}) — ${r.name}:`);
  r._warnings.forEach((w) => console.warn(`   · ${w}`));
});

// ── Write output (strip internal fields) ─────────────────────────────────────
const clean = results.map(({ _warnings, _source_id, ...rest }) => rest);
fs.writeFileSync(outputPath, JSON.stringify(clean, null, 2), "utf-8");

console.log(`\n✓ Transformed ${results.length} clinic(s) → ${outputPath}`);
console.log(`  Skipped (archived): ${skippedArchived}`);
if (warned > 0) {
  console.log(`  ${warned} record(s) had warnings — review above before importing`);
}
