#!/usr/bin/env tsx
/**
 * transform-interpreters.ts
 *
 * Transforms a raw Nowsta staff CSV export into clean interpreter JSON
 * ready for DB import via seed-interpreters.ts.
 *
 * Usage:
 *   cd /path/to/Dev
 *   pnpm tsx scripts/transform-interpreters.ts <input.csv> [output.json]
 *
 * Output defaults to <input-dir>/interpreters-clean.json
 */

import fs   from "node:fs";
import path from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CleanInterpreter {
  name:                 string;
  phone:                string;
  email:                string | null;
  type:                 "qualified" | "certified" | "qualified_and_certified";
  languages:            string[];
  payment_method:       string | null;
  address_line1:        string | null;
  address_line2:        string | null;
  city:                 string | null;
  state:                string | null;
  zip_code:             string | null;
  emergency_contact:    { name: string; phone: string } | null;
  notes:                string | null;
  priority:             "high" | "medium" | null;
  preferred_cities:     string[];
  pay_rate:             number | null;
  pay_rate_certified:   number | null;
  extra_rates:          Record<string, number> | null;
  is_active:            boolean;
}

interface RowWithWarnings extends CleanInterpreter {
  _warnings: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_MAP: Record<string, "high" | "medium"> = {
  "Prioridad Alta":  "high",
  "Prioridad Media": "medium",
};

// Tags that carry semantic meaning — everything else is a preferred city
const SEMANTIC_TAGS = new Set([
  "Qualified", "Certified",
  ...Object.keys(PRIORITY_MAP),
]);

// State abbreviation normaliser — extend if more variants appear
const STATE_MAP: Record<string, string> = {
  Cal:        "CA",
  California: "CA",
  Va:         "CA",   // Watsonville/Salinas area — clearly a typo
};

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current  = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // escaped double-quote inside a quoted field
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

/** Title-case a string only if it is entirely uppercase (e.g. "RAMIREZ" → "Ramirez").
 *  Mixed-case strings like "AnaLaura" or "de Franco" are left untouched. */
function maybeToTitleCase(str: string): string {
  if (!str) return str;
  const letters = str.replace(/[^A-Za-z]/g, "");
  if (letters.length > 0 && letters === letters.toUpperCase()) {
    return str
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return str;
}

function normalisePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function parseRate(raw: string): number | null {
  const n = parseFloat(raw.replace(/[$,\s]/g, ""));
  return isNaN(n) ? null : n;
}

/** Convert a position label into a snake_case key for extra_rates.
 *  e.g. "QME Interp" → "qme_interp"  |  "Rate 37,50" → "rate_37_50"  */
function toRateKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normaliseState(raw: string): string {
  return STATE_MAP[raw.trim()] ?? raw.trim();
}

// ─── Row transform ────────────────────────────────────────────────────────────

function transformRow(row: Record<string, string>): RowWithWarnings {
  const warnings: string[] = [];

  // ── Name ──────────────────────────────────────────────────────────────────
  const first = maybeToTitleCase(row["First Name"]?.trim() ?? "");
  const last  = maybeToTitleCase(row["Last Name"]?.trim()  ?? "");
  const name  = `${first} ${last}`.trim();

  // ── Phone ─────────────────────────────────────────────────────────────────
  const rawPhone = normalisePhone(row["Phone Number"] ?? "");
  const phone    = rawPhone || "0000000000";
  if (!rawPhone) warnings.push("No phone — placeholder '0000000000' used");

  // ── Email / payment method ────────────────────────────────────────────────
  const email          = row["Email"]?.trim()      || null;
  const payment_method = row["Tax Status"]?.trim() || null;

  // ── Address ───────────────────────────────────────────────────────────────
  const address_line1 = row["Address 1"]?.trim() || null;
  const address_line2 = row["Address 2"]?.trim() || null;
  const city          = row["City"]?.replace(/,\s*$/, "").trim() || null;
  const rawState      = row["State"]?.trim();
  const state         = rawState ? normaliseState(rawState) : null;
  const zip_code      = row["Zip"]?.trim() || null;

  // ── Emergency contact ─────────────────────────────────────────────────────
  const ecName  = row["Emergency Contact Name"]?.trim() ?? "";
  const ecPhone = normalisePhone(row["Emergency Contact Phone Number"] ?? "");
  const emergency_contact = ecName ? { name: ecName, phone: ecPhone } : null;

  // ── Notes ─────────────────────────────────────────────────────────────────
  const notes = row["Notes"]?.trim() || null;

  // ── Tags → type / priority / preferred_cities ─────────────────────────────
  const tagValues: string[] = [];
  for (let i = 1; i <= 27; i++) {
    const v = row[`Tag ${i}`]?.trim();
    if (v) tagValues.push(v);
  }

  let hasQualified = false;
  let hasCertified = false;
  let priority: "high" | "medium" | null = null;
  const preferred_cities: string[] = [];

  for (const tag of tagValues) {
    if (tag === "Qualified")    { hasQualified = true; continue; }
    if (tag === "Certified")    { hasCertified = true; continue; }
    if (PRIORITY_MAP[tag])      { priority = PRIORITY_MAP[tag]; continue; }
    preferred_cities.push(tag);
  }

  let type: "qualified" | "certified" | "qualified_and_certified";
  if      (hasQualified && hasCertified) type = "qualified_and_certified";
  else if (hasCertified)                 type = "certified";
  else if (hasQualified)                 type = "qualified";
  else {
    type = "qualified"; // safe default — client to verify
    warnings.push("No type tag found — defaulted to 'qualified'. Please verify on front end.");
  }

  // ── Positions / Rates ─────────────────────────────────────────────────────
  let pay_rate:           number | null = null;
  let pay_rate_certified: number | null = null;
  const extra_rates: Record<string, number> = {};

  for (let i = 1; i <= 12; i++) {
    const pos     = row[`Position ${i}`]?.trim();
    const rateStr = row[`Rate ${i}`]?.trim();
    if (!pos || !rateStr) continue;

    const rateVal = parseRate(rateStr);
    if (rateVal === null) {
      warnings.push(`Could not parse rate for "${pos}": "${rateStr}" — skipped`);
      continue;
    }

    if      (pos === "Interpreter normal")    pay_rate           = rateVal;
    else if (pos === "Interpreter - Certified") pay_rate_certified = rateVal;
    else                                      extra_rates[toRateKey(pos)] = rateVal;
  }

  return {
    name,
    phone,
    email,
    type,
    languages:          ["es"],
    payment_method,
    address_line1,
    address_line2,
    city,
    state,
    zip_code,
    emergency_contact,
    notes,
    priority,
    preferred_cities,
    pay_rate,
    pay_rate_certified,
    extra_rates: Object.keys(extra_rates).length > 0 ? extra_rates : null,
    is_active:   true,
    _warnings:   warnings,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, inputArg, outputArg] = process.argv;

if (!inputArg) {
  console.error("Usage: pnpm tsx scripts/transform-interpreters.ts <input.csv> [output.json]");
  process.exit(1);
}

const inputPath  = path.resolve(inputArg);
const outputPath = outputArg
  ? path.resolve(outputArg)
  : path.join(path.dirname(inputPath), "interpreters-clean.json");

const content = fs.readFileSync(inputPath, "utf-8");
const rows    = parseCSV(content);
const results = rows.map(transformRow);

// ── Print warnings ────────────────────────────────────────────────────────────
let warned = 0;
results.forEach((r, i) => {
  if (r._warnings.length === 0) return;
  warned++;
  console.warn(`\n⚠  Row ${i + 1} — ${r.name}:`);
  r._warnings.forEach((w) => console.warn(`   · ${w}`));
});

// ── Write output (strip internal _warnings field) ─────────────────────────────
const clean = results.map(({ _warnings, ...rest }) => rest);
fs.writeFileSync(outputPath, JSON.stringify(clean, null, 2), "utf-8");

console.log(`\n✓ Transformed ${results.length} record(s) → ${outputPath}`);
if (warned > 0) {
  console.log(`  ${warned} record(s) had warnings — review above before importing`);
}
