#!/usr/bin/env tsx
/**
 * transform-agencies.ts
 *
 * Transforms the SEGUROS.xlsx insurance-agency spreadsheet into clean JSON
 * ready for DB import via seed-agencies.ts.
 *
 * Usage:
 *   cd /path/to/Dev
 *   pnpm tsx scripts/transform-agencies.ts <SEGUROS.xlsx> [output.json]
 *
 * Output defaults to <input-dir>/agencies-clean.json
 *
 * Requires: xlsx  (pnpm add -D xlsx  OR  npm i -D xlsx)
 */

import fs   from "node:fs";
import path from "node:path";
// @ts-ignore — xlsx has no bundled types in all versions
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CleanAgency {
  name:                  string;
  address:               string | null;
  city:                  string | null;
  state:                 string | null;
  zip_code:              string | null;
  fax:                   string | null;
  phone:                 string | null;
  primary_contact_email: string | null;
}

interface RowWithWarnings extends CleanAgency {
  _warnings: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Normalise common full/variant state names to 2-letter abbreviations */
const STATE_MAP: Record<string, string> = {
  Alabama:        "AL",
  Alaska:         "AK",
  Arizona:        "AZ",
  Arkansas:       "AR",
  California:     "CA",
  Colorado:       "CO",
  Connecticut:    "CT",
  Delaware:       "DE",
  Florida:        "FL",
  Georgia:        "GA",
  Hawaii:         "HI",
  Idaho:          "ID",
  Illinois:       "IL",
  Indiana:        "IN",
  Iowa:           "IA",
  Kansas:         "KS",
  Kentucky:       "KY",
  Louisiana:      "LA",
  Maine:          "ME",
  Maryland:       "MD",
  Massachusetts:  "MA",
  Michigan:       "MI",
  Minnesota:      "MN",
  Mississippi:    "MS",
  Missouri:       "MO",
  Montana:        "MT",
  Nebraska:       "NE",
  Nevada:         "NV",
  "New Hampshire":"NH",
  "New Jersey":   "NJ",
  "New Mexico":   "NM",
  "New York":     "NY",
  "North Carolina":"NC",
  "North Dakota": "ND",
  Ohio:           "OH",
  Oklahoma:       "OK",
  Oregon:         "OR",
  Pennsylvania:   "PA",
  "Rhode Island": "RI",
  "South Carolina":"SC",
  "South Dakota": "SD",
  Tennessee:      "TN",
  Texas:          "TX",
  Utah:           "UT",
  Vermont:        "VT",
  Virginia:       "VA",
  Washington:     "WA",
  "West Virginia":"WV",
  Wisconsin:      "WI",
  Wyoming:        "WY",
  // Typos / variants found in this dataset
  Luisiana:       "LA",
  Tenesse:        "TN",
  Tx:             "TX",
  // Ambiguous abbreviation — KT appears to be a typo for KY (Kentucky)
  KT:             "KY",
  // Non-US territory in dataset
  AI:             "AI",   // preserve as-is (likely Anguilla or data error)
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseState(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Already a valid 2-letter code (uppercase)
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  // Look up full name or mixed-case variant
  return STATE_MAP[trimmed] ?? trimmed.toUpperCase().slice(0, 2);
}

function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

function cleanStr(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).replace(/,+$/, "").trim();
  return s || null;
}

function normaliseZip(raw: unknown): string | null {
  if (raw == null) return null;
  // xlsx may parse zip as number (e.g. 95765 → 95765)
  const s = String(raw).replace(/[^0-9]/g, "").padStart(5, "0").slice(0, 5);
  return s && s !== "00000" ? s : null;
}

// ─── Row transform ────────────────────────────────────────────────────────────

function transformRow(row: Record<string, unknown>): RowWithWarnings {
  const warnings: string[] = [];

  const name = cleanStr(row["name"]);
  if (!name) warnings.push("Empty name — record may be junk");

  const rawState = cleanStr(row["state"]);
  const state    = normaliseState(rawState);
  if (rawState && state !== rawState.trim().toUpperCase() && rawState.length > 2) {
    warnings.push(`State "${rawState}" normalised to "${state}"`);
  }
  if (rawState === "AI") {
    warnings.push(`State "AI" is unusual — verify this record`);
  }
  if (rawState === "KT") {
    warnings.push(`State "KT" looks like a typo for "KY" (Kentucky) — mapped to KY`);
  }

  return {
    _warnings:             warnings,
    name:                  name ?? "",
    address:               cleanStr(row["address"]),
    city:                  cleanStr(row["city"]),
    state,
    zip_code:              normaliseZip(row["zip"]),
    fax:                   normalisePhone(row["fax"]),
    phone:                 normalisePhone(row["phone"]),
    primary_contact_email: cleanStr(row["email"]),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, inputArg, outputArg] = process.argv;

if (!inputArg) {
  console.error("Usage: pnpm tsx scripts/transform-agencies.ts <SEGUROS.xlsx> [output.json]");
  process.exit(1);
}

const inputPath  = path.resolve(inputArg);
const outputPath = outputArg
  ? path.resolve(outputArg)
  : path.join(path.dirname(inputPath), "agencies-clean.json");

// Read xlsx
const workbook  = XLSX.readFile(inputPath);
const sheetName = workbook.SheetNames[0];
const sheet     = workbook.Sheets[sheetName];
const rawRows   = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];

// Filter out completely empty rows (xlsx pads to 1000)
const nonEmpty = rawRows.filter((r) =>
  Object.values(r).some((v) => v !== null && String(v).trim() !== "")
);

console.log(`Read ${nonEmpty.length} non-empty row(s) from ${inputPath}`);

const results = nonEmpty.map(transformRow);

// ── Print warnings ────────────────────────────────────────────────────────────
let warned = 0;
results.forEach((r, i) => {
  if (r._warnings.length === 0) return;
  warned++;
  console.warn(`\n⚠  Row ${i + 1} — ${r.name || "(no name)"}:`);
  r._warnings.forEach((w) => console.warn(`   · ${w}`));
});

// ── Write output ──────────────────────────────────────────────────────────────
const clean = results.map(({ _warnings, ...rest }) => rest);
fs.writeFileSync(outputPath, JSON.stringify(clean, null, 2), "utf-8");

console.log(`\n✓ Transformed ${results.length} record(s) → ${outputPath}`);
if (warned > 0) {
  console.log(`  ${warned} record(s) had warnings — review above before importing`);
}
