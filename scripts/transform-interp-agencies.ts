#!/usr/bin/env tsx
/**
 * transform-interp-agencies.ts
 *
 * Transforms the Nowsta agencies CSV (interpreting subcontractor agencies)
 * into clean JSON ready for DB import via seed-interp-agencies.ts.
 *
 * Usage:
 *   cd /path/to/Dev
 *   pnpm tsx scripts/transform-interp-agencies.ts <agencies.csv> [output.json]
 *
 * Rules:
 *  - Archived records (Archived At non-empty) are skipped.
 *  - Admin Notes stored as-is in the notes field.
 *  - Contact Full Name / Phone / Email mapped to primary_contact_* fields.
 *  - Names trimmed; trailing/leading whitespace cleaned.
 *  - Phone normalised to digits only.
 */

import fs   from "node:fs";
import path from "node:path";

interface CleanAgency {
  name:                  string;
  notes:                 string | null;
  phone:                 string | null;
  primary_contact_name:  string | null;
  primary_contact_phone: string | null;
  primary_contact_email: string | null;
}

interface RowWithWarnings extends CleanAgency {
  _warnings: string[];
  _source_id: string;
}

// ─── CSV parser (handles multiline quoted fields) ────────────────────────────

function parseCSV(content: string): Record<string, string>[] {
  // Parse the entire file character-by-character to handle newlines inside quotes
  const records: string[][] = [];
  let current = "";
  let inQuotes = false;
  let currentRecord: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') { current += '"'; i++; }   // escaped quote
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      currentRecord.push(current); current = "";
    } else if ((ch === "\n" || (ch === "\r" && next === "\n")) && !inQuotes) {
      if (ch === "\r") i++; // skip \n after \r
      currentRecord.push(current); current = "";
      if (currentRecord.some(f => f !== "")) records.push(currentRecord);
      currentRecord = [];
    } else {
      current += ch;
    }
  }
  // last field
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

function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

function clean(raw: string): string | null {
  const s = raw.trim();
  return s || null;
}

// ─── Row transform ────────────────────────────────────────────────────────────

function transformRow(row: Record<string, string>): RowWithWarnings | null {
  // Skip archived
  if (row["Archived At"]?.trim()) return null;

  const warnings: string[] = [];
  const name = row["Name"]?.trim() ?? "";
  if (!name) warnings.push("Empty name — skipping");

  // The Contact Phone Number field sometimes contains extension info or
  // multiple numbers — store raw in primary_contact_phone, also try to
  // use it as the main phone if no other phone exists.
  const rawContactPhone = row["Contact Phone Number"]?.trim() ?? "";
  const primaryPhone    = normalisePhone(rawContactPhone);

  // Some records stuff the email into the Contact Email field as a URL
  // (e.g. Simply 01 — the "email" is a Google Form link). Flag these.
  const rawEmail = row["Contact Email"]?.trim() ?? "";
  const email    = rawEmail.startsWith("http") ? null : (rawEmail || null);
  if (rawEmail.startsWith("http")) {
    warnings.push(`Contact Email looks like a URL ("${rawEmail.slice(0, 40)}...") — cleared`);
  }

  return {
    _source_id:            row["Id"] ?? "",
    _warnings:             warnings,
    name,
    notes:                 clean(row["Admin Notes"] ?? ""),
    phone:                 primaryPhone,
    primary_contact_name:  clean(row["Contact Full Name"] ?? ""),
    primary_contact_phone: rawContactPhone || null,
    primary_contact_email: email,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, inputArg, outputArg] = process.argv;
if (!inputArg) {
  console.error("Usage: pnpm tsx scripts/transform-interp-agencies.ts <agencies.csv> [output.json]");
  process.exit(1);
}

const inputPath  = path.resolve(inputArg);
const outputPath = outputArg
  ? path.resolve(outputArg)
  : path.join(path.dirname(inputPath), "interp-agencies-clean.json");

const content = fs.readFileSync(inputPath, "utf-8");
const rows    = parseCSV(content);

let skippedArchived = 0;
const results: RowWithWarnings[] = [];

for (const row of rows) {
  const result = transformRow(row);
  if (result === null) { skippedArchived++; continue; }
  results.push(result);
}

// Print warnings
let warned = 0;
results.forEach((r, i) => {
  if (r._warnings.length === 0) return;
  warned++;
  console.warn(`\n⚠  Row ${i + 1} (ID ${r._source_id}) — ${r.name}:`);
  r._warnings.forEach(w => console.warn(`   · ${w}`));
});

const clean2 = results.map(({ _warnings, _source_id, ...rest }) => rest);
fs.writeFileSync(outputPath, JSON.stringify(clean2, null, 2), "utf-8");

console.log(`\n✓ Transformed ${results.length} agency record(s) → ${outputPath}`);
console.log(`  Skipped (archived): ${skippedArchived}`);
if (warned > 0) console.log(`  ${warned} record(s) had warnings — review above`);
