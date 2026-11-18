#!/usr/bin/env tsx
/**
 * import-nowsta-csv.ts
 *
 * Imports appointments from a Nowsta "Event Overview" CSV export.
 * This REPLACES all existing appointments (and related records) in the org.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." \
 *   pnpm tsx apps/api/scripts/import-nowsta-csv.ts <csv-file> [org-slug]
 *
 * What it does:
 *  1. Parses the CSV (handles multi-line Shift 1 field)
 *  2. Deletes all existing appointments + related data for the org
 *  3. Matches clinics and agencies by name (case-insensitive, fuzzy)
 *  4. Creates patients as needed (parses DOB from name field)
 *  5. Matches interpreters by name from Shift 1 field
 *  6. Creates appointments with proper billing_status mapping
 */

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildNameMap<T extends { id: string; name: string }>(records: T[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of records) map.set(norm(r.name), r.id);
  return map;
}

/** Parse "Wednesday, Jul 17, 2024" → Date object (date only, midnight UTC) */
function parseDate(dateStr: string): Date | null {
  // Strip leading day name: "Wednesday, Jul 17, 2024" → "Jul 17, 2024"
  const cleaned = dateStr.replace(/^[A-Za-z]+,\s*/, "").trim();
  const d = new Date(cleaned + " UTC");
  return isNaN(d.getTime()) ? null : d;
}

/** Convert a wall-clock time in `tz` to the matching UTC instant (DST-aware). */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, mo, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value);
  const asTz = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess - (asTz - guess));
}

/** Parse "1:00 PM - 2:00 PM" → { startHour, startMin, endHour, endMin } */
function parseTimeRange(timeStr: string): { startH: number; startM: number; endH: number; endM: number } | null {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let [, sh, sm, sap, eh, em, eap] = match;
  let startH = parseInt(sh), startM = parseInt(sm);
  let endH = parseInt(eh), endM = parseInt(em);
  if (sap.toUpperCase() === "PM" && startH !== 12) startH += 12;
  if (sap.toUpperCase() === "AM" && startH === 12) startH = 0;
  if (eap.toUpperCase() === "PM" && endH !== 12) endH += 12;
  if (eap.toUpperCase() === "AM" && endH === 12) endH = 0;
  return { startH, startM, endH, endM };
}

/** Extract DOB from "CARLOS SANTELLAN DOB 03/02/1955" or "Angye Arboleda  11/24/1998" */
function extractDob(name: string): { cleanName: string; dob: string | null } {
  const dobMatch = name.match(/\s(?:DOB\s*:?\s*)?(\d{1,2}\/\d{1,2}\/\d{2,4})\s*$/i);
  if (!dobMatch || dobMatch.index === 0) return { cleanName: name.trim(), dob: null };
  const cleanName = name.slice(0, dobMatch.index).trim();
  const [mm, dd, yyyy] = dobMatch[1].split("/");
  const year = yyyy.length === 2 ? (parseInt(yyyy) > 50 ? `19${yyyy}` : `20${yyyy}`) : yyyy;
  return { cleanName, dob: `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}` };
}

/** Parse interpreter name and type from Shift 1 field */
function parseShift1(shift: string): { interpreterName: string | null; interpreterType: string } {
  if (!shift.trim()) return { interpreterName: null, interpreterType: "qualified" };

  const lines = shift.split("\n").map(l => l.trim()).filter(Boolean);

  // Determine type from first line
  let interpreterType = "qualified";
  if (lines[0]) {
    const lower = lines[0].toLowerCase();
    if (lower.includes("certified") || lower.includes("cert")) interpreterType = "certified";
    if (lower.includes("qme")) interpreterType = "certified";
  }

  // Interpreter name from second line: "Ruth Saro - Confirmed"
  let interpreterName: string | null = null;
  if (lines.length >= 2 && lines[1].includes(" - ")) {
    const parts = lines[1].rsplit ? lines[1].split(" - ") : lines[1].split(" - ");
    // Last part is status, everything before is name
    interpreterName = parts.slice(0, -1).join(" - ").trim();
    if (interpreterName.toLowerCase() === "extra worker") interpreterName = null;
  }

  return { interpreterName, interpreterType };
}

/** Map Department column to billing_status */
function mapBillingStatus(dept: string): string {
  const d = dept.trim().toLowerCase();
  if (!d) return "";
  if (d === "paid") return "Paid";
  if (d === "billed") return "Billed";
  if (d === "approved") return "Approved";
  if (d === "pending") return "Pending Approval";
  if (d === "bi") return "Billed";
  if (d === "invoiced") return "Invoiced";
  if (d === "not paid") return "Not Paid";
  if (d === "payment under claim") return "Payment Under Claim";
  if (d === "retro") return "Retro";
  if (d === "loss") return "Loss";
  return "";
}

// ─── Clinic name mappings (CSV name → DB name) ──────────────────────────────

const CLINIC_NAME_MAP: Record<string, string> = {
  "Fyzical Therapy And Balance Centers": "Fyzical",
  "telemed - home": "Telemed",
  "Dr Halamandaris Montage Orthopedics And Sports Medicine": "Montage Orthopedics And Sports Medicine",
  "(Bannister Certified Hand Therapy)": "BANISTER CERTIFIED HAND THERAPY",
  "TERRANCE DELANEY, M.D.": "Dr. Terrance Delaney",
  "Silicon Valley Surgery Center - Campbell": "SILICON VALLEY SURGERY CENTER",
  "Alleviate Health Group - Watsonville": "ALLEVIATE HEALTH GROUP",
  "NMCI - Gilroy": "NMCI Gilroy",
  "DR NATHANIEL COHEN": "Dr. Nathaniel Cohen",
  "Salinas Valley Health": "SALINAS VALLEY HEALTH ORTHOPEDICS",
  "Dr Gowda": "Dr Gowda I SPINE",
  "DOUGLAS ABELES  QME": "DOUGLAS ABELES",
  "Beyond Prosthetics": "BEYOND PROSTETIC INC",
  "Boomerang Healthcare Los Gatos": "Boomerang - Los Gatos",
  "Boomerang salinas": "Boomerang - Salinas",
  "Sovathana Khuong, DC": "Dr. Sovathana Khuong",
  "Dr. Timothy Lo - Los Gatos": "Dr. Timothy Lo",
  "441 UNION ST, Watsonville QME": "441 UNION ST, Watsonville",
  "RESIDENTIAL ADDRESS": "Home Address",
  "Select Physical Therapy Morgan": "Select Physical Therapy Monterrey",
  "Dr Halamandaris": "Montage Orthopedics And Sports Medicine",
};

// Clinics to skip entirely (pending client input)
const SKIP_CLINICS = new Set([
  "Boomerang Health Care",
  "Agile",
  "Doctors on Duty - Salinas",
  "Boomerang Healthcare Walnut Creek",
  "Boomerang Healthcare - Oakland",
  "Boomerang Health Care - San Francisco",
  "Boomerang Health Care - Walnut Creek",
].map(norm));

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const noDelete = args.includes("--no-delete");
  const positional = args.filter(a => !a.startsWith("--"));
  const [csvArg, orgSlug] = positional;
  if (!csvArg) {
    console.error("Usage: DATABASE_URL=... pnpm tsx apps/api/scripts/import-nowsta-csv.ts <csv> [org-slug] [--no-delete]");
    process.exit(1);
  }

  const csvContent = fs.readFileSync(path.resolve(csvArg), "utf-8");
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as Record<string, string>[];
  console.log(`Parsed ${rows.length} CSV rows`);

  // ── Organisation ───────────────────────────────────────────────────────────
  const org = orgSlug
    ? await prisma.organization.findUnique({ where: { slug: orgSlug } })
    : await prisma.organization.findFirst();
  if (!org) throw new Error(orgSlug ? `No org with slug "${orgSlug}"` : "No org found");
  console.log(`Organisation: ${org.name} (${org.id})`);
  const settings = await prisma.systemSettings.findFirst({ select: { timezone: true } });
  const orgTz = settings?.timezone ?? "America/Los_Angeles";
  console.log(`Timezone: ${orgTz}\n`);

  // ── Lookup maps ─────────────────────────────────────────────────────────────
  const [dbClinics, dbAgencies, dbTypes, dbInterpreters] = await Promise.all([
    prisma.clinic.findMany({ where: { organization_id: org.id }, select: { id: true, name: true } }),
    prisma.agency.findMany({ where: { organization_id: org.id }, select: { id: true, name: true } }),
    prisma.appointmentType.findMany({ select: { id: true, name: true } }),
    prisma.interpreter.findMany({ where: { organization_id: org.id }, select: { id: true, name: true } }),
  ]);

  const clinicMap = buildNameMap(dbClinics);
  const agencyMap = buildNameMap(dbAgencies);
  const typeMap = buildNameMap(dbTypes);
  const interpreterNameMap = new Map<string, string>();
  for (const i of dbInterpreters) interpreterNameMap.set(norm(i.name), i.id);

  console.log(`DB records: ${dbClinics.length} clinics, ${dbAgencies.length} agencies, ${dbInterpreters.length} interpreters, ${dbTypes.length} types\n`);

  // ── Delete existing appointments (skip with --no-delete) ────────────────────
  if (noDelete) {
    console.log("--no-delete: skipping deletion, adding appointments to existing data.\n");
  } else {
    console.log("Deleting existing appointment data...");
    // Must delete in FK order
    await prisma.$transaction([
      prisma.appointmentMedia.deleteMany({ where: { appointment: { organization_id: org.id } } }),
      prisma.appointmentNote.deleteMany({ where: { organization_id: org.id } }),
      prisma.appointmentActivity.deleteMany({ where: { organization_id: org.id } }),
      prisma.followUpResponse.deleteMany({ where: { appointment: { organization_id: org.id } } }),
      prisma.followUpDraft.deleteMany({ where: { appointment: { organization_id: org.id } } }),
      prisma.emailIntakeDraft.deleteMany({ where: { appointment: { organization_id: org.id } } }),
      prisma.appointmentOffer.deleteMany({ where: { appointment: { organization_id: org.id } } }),
      prisma.invoice.deleteMany({ where: { appointment: { organization_id: org.id } } }),
      prisma.adminAlert.deleteMany({ where: { organization_id: org.id } }),
      prisma.appointment.deleteMany({ where: { organization_id: org.id } }),
    ]);
    console.log(`Deleted existing appointments. Starting import...\n`);
  }

  // ── Process rows ────────────────────────────────────────────────────────────
  const unmatchedClinics = new Map<string, number>();
  const unmatchedAgencies = new Map<string, number>();
  let created = 0, skipped = 0, errorCount = 0;

  // Patient cache to avoid repeated DB queries
  const patientCache = new Map<string, string>(); // norm(name) → id

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i > 0 && i % 1000 === 0) console.log(`  ... processed ${i}/${rows.length}`);

    // ── Parse date + time ──────────────────────────────────────────────────
    const dateObj = parseDate(row["Date"] ?? "");
    if (!dateObj) { skipped++; continue; }

    const timeRange = parseTimeRange(row["Event Time"] ?? "");
    if (!timeRange) { skipped++; continue; }

    // CSV times are wall-clock in the org timezone, not UTC
    const dateTime = zonedToUtc(
      dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(),
      timeRange.startH, timeRange.startM, orgTz,
    );

    // Duration in minutes
    let durationMin = (timeRange.endH * 60 + timeRange.endM) - (timeRange.startH * 60 + timeRange.startM);
    if (durationMin <= 0) durationMin += 24 * 60; // crosses midnight
    if (durationMin <= 0 || durationMin > 720) durationMin = 60; // fallback

    // ── Patient ────────────────────────────────────────────────────────────
    const rawName = (row["Name"] ?? "").trim();
    if (!rawName) { skipped++; continue; }
    const { cleanName: patientName, dob: patientDob } = extractDob(rawName);

    // ── Clinic ─────────────────────────────────────────────────────────────
    const venueName = (row["Venue"] ?? "").trim();
    if (!venueName) { skipped++; continue; }

    // Skip clinics pending client input
    if (SKIP_CLINICS.has(norm(venueName))) {
      unmatchedClinics.set(venueName + " [SKIPPED]", (unmatchedClinics.get(venueName + " [SKIPPED]") ?? 0) + 1);
      skipped++;
      continue;
    }

    // Apply name mapping if available
    const mappedClinicName = CLINIC_NAME_MAP[venueName] ?? venueName;
    let clinicId = clinicMap.get(norm(mappedClinicName));

    // Auto-create clinic if still not found
    if (!clinicId) {
      try {
        const newClinic = await prisma.clinic.create({
          data: {
            organization_id: org.id,
            name: venueName,
            billing_model: "hourly",
            is_active: true,
          },
        });
        clinicId = newClinic.id;
        clinicMap.set(norm(venueName), newClinic.id);
        console.log(`  ➕ Created clinic: ${venueName}`);
      } catch {
        const existing = await prisma.clinic.findFirst({
          where: { organization_id: org.id, name: { equals: venueName, mode: "insensitive" } },
          select: { id: true },
        });
        if (existing) {
          clinicId = existing.id;
          clinicMap.set(norm(venueName), existing.id);
        } else {
          unmatchedClinics.set(venueName, (unmatchedClinics.get(venueName) ?? 0) + 1);
          skipped++;
          continue;
        }
      }
    }

    // ── Agency ─────────────────────────────────────────────────────────────
    const clientName = (row["Client"] ?? "").trim();
    if (!clientName) { skipped++; continue; }
    let agencyId = agencyMap.get(norm(clientName));

    // Auto-create agency if not found
    if (!agencyId) {
      try {
        const newAgency = await prisma.agency.create({
          data: {
            organization_id: org.id,
            name: clientName,
            is_active: true,
          },
        });
        agencyId = newAgency.id;
        agencyMap.set(norm(clientName), newAgency.id);
        console.log(`  ➕ Created agency: ${clientName}`);
      } catch {
        const existing = await prisma.agency.findFirst({
          where: { organization_id: org.id, name: { equals: clientName, mode: "insensitive" } },
          select: { id: true },
        });
        if (existing) {
          agencyId = existing.id;
          agencyMap.set(norm(clientName), existing.id);
        } else {
          unmatchedAgencies.set(clientName, (unmatchedAgencies.get(clientName) ?? 0) + 1);
          skipped++;
          continue;
        }
      }
    }

    // ── Shift 1 → interpreter + type ───────────────────────────────────────
    const { interpreterName, interpreterType } = parseShift1(row["Shift 1"] ?? "");

    // Resolve interpreter
    let interpreterId: string | null = null;
    if (interpreterName) {
      interpreterId = interpreterNameMap.get(norm(interpreterName)) ?? null;
      // Auto-create inactive interpreter if not found
      if (!interpreterId) {
        try {
          const newInterp = await prisma.interpreter.create({
            data: {
              organization_id: org.id,
              name: interpreterName,
              phone: "",
              type: interpreterType,
              languages: ["es"],
              is_active: false,
            },
          });
          interpreterId = newInterp.id;
          interpreterNameMap.set(norm(interpreterName), newInterp.id);
          console.log(`  ➕ Created inactive interpreter: ${interpreterName}`);
        } catch {
          const existing = await prisma.interpreter.findFirst({
            where: { organization_id: org.id, name: { equals: interpreterName, mode: "insensitive" } },
            select: { id: true },
          });
          if (existing) {
            interpreterId = existing.id;
            interpreterNameMap.set(norm(interpreterName), existing.id);
          }
        }
      }
    }

    // ── Appointment type ───────────────────────────────────────────────────
    const typeName = interpreterType === "certified" ? "Certified" : "Qualified";
    const typeId = typeMap.get(norm(typeName));
    if (!typeId) {
      console.warn(`  ⚠ No appointment type "${typeName}" found — skipping`);
      skipped++;
      continue;
    }

    // ── Patient upsert ─────────────────────────────────────────────────────
    const patientKey = norm(patientName);
    let patientId = patientCache.get(patientKey);
    if (!patientId) {
      const existing = await prisma.patient.findFirst({
        where: { organization_id: org.id, name: { equals: patientName, mode: "insensitive" } },
        select: { id: true, date_of_birth: true },
      });
      if (existing) {
        patientId = existing.id;
        if (patientDob && !existing.date_of_birth) {
          await prisma.patient.update({
            where: { id: patientId },
            data: { date_of_birth: new Date(patientDob + "T00:00:00Z") },
          });
        }
      } else {
        const newPatient = await prisma.patient.create({
          data: {
            organization_id: org.id,
            name: patientName,
            date_of_birth: patientDob ? new Date(patientDob + "T00:00:00Z") : null,
          },
        });
        patientId = newPatient.id;
      }
      patientCache.set(patientKey, patientId);
    }

    // ── Billing status ─────────────────────────────────────────────────────
    const billingStatus = mapBillingStatus(row["Department"] ?? "");

    // ── PO number ──────────────────────────────────────────────────────────
    const rawPo = (row["Event ID"] ?? "").trim();
    const poNumber = rawPo && rawPo !== "01" ? rawPo : null;

    // ── Admin notes ────────────────────────────────────────────────────────
    const adminNotes = (row["Admin Notes"] ?? "").trim() || null;

    // ── Salesperson → referring_physician ───────────────────────────────────
    const salesperson = (row["Salesperson"] ?? "").trim() || null;

    // ── Status ─────────────────────────────────────────────────────────────
    const isPast = dateTime <= new Date();
    const status = isPast ? "completed" : (interpreterId ? "accepted" : "unassigned");

    // ── Create appointment ─────────────────────────────────────────────────
    try {
      const newAppt = await prisma.appointment.create({
        data: {
          organization_id: org.id,
          status,
          source: "csv_import",
          date_time: dateTime,
          duration_minutes: durationMin,
          type_id: typeId,
          language: "es",
          interpreter_type_required: interpreterType,
          interpreter_id: interpreterId,
          clinic_id: clinicId,
          agency_id: agencyId,
          patient_id: patientId,
          po_number: poNumber,
          billing_interpreter: salesperson,
          billing_status: billingStatus,
          billing_amount: null,
          pre_auth_amount: new Prisma.Decimal(0),
          pre_auth_mileage: 0,
        },
      });

      if (adminNotes) {
        await prisma.appointmentNote.create({
          data: {
            appointment_id: newAppt.id,
            organization_id: org.id,
            content: adminNotes.slice(0, 800),
            admin_name: "Nowsta Import",
            admin_id: null,
          },
        });
      }

      created++;
    } catch (e) {
      console.error(`  ✗ Row ${i + 2}: ${patientName} @ ${venueName}:`, (e as Error).message?.slice(0, 120));
      errorCount++;
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Done.  Created: ${created}  |  Skipped: ${skipped}  |  Errors: ${errorCount}`);
  console.log(`Total rows: ${rows.length}`);

  if (unmatchedClinics.size > 0) {
    console.log(`\n⚠ Unmatched clinics (${unmatchedClinics.size} names, skipped appointments):`);
    [...unmatchedClinics.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => console.log(`   ${count.toString().padStart(4)}x  "${name}"`));
  }

  if (unmatchedAgencies.size > 0) {
    console.log(`\n⚠ Unmatched agencies (${unmatchedAgencies.size} names, skipped appointments):`);
    [...unmatchedAgencies.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => console.log(`   ${count.toString().padStart(4)}x  "${name}"`));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
