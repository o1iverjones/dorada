#!/usr/bin/env tsx
/**
 * seed-appointments.ts
 *
 * Seeds appointments from the JSON produced by scripts/transform-appointments.ts.
 *
 * Usage (from repo root):
 *   DATABASE_URL="postgresql://..." \
 *   pnpm tsx apps/api/scripts/seed-appointments.ts <appointments-clean.json> [org-slug]
 *
 * Behaviour:
 *  - Looks up clinics and agencies by name (case-insensitive).
 *  - Upserts patients by MRN (if non-empty) or by name (case-insensitive).
 *  - Skips appointments whose clinic or agency cannot be resolved — reports
 *    all unresolved names at the end so they can be fixed.
 *  - Skips duplicate appointments (same date_time + clinic_id + patient_id).
 *  - Sets status="completed" and source="csv_import" on all created records.
 */

import fs   from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import type { CleanAppointment } from "../../../scripts/transform-appointments.js";

const prisma = new PrismaClient();

// ─── Fuzzy name matching ───────────────────────────────────────────────────────
// Normalise a name to lowercase, collapse whitespace, strip common suffixes
// that differ between Nowsta exports and DB records.
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildNameMap<T extends { id: string; name: string }>(
  records: T[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of records) {
    map.set(norm(r.name), r.id);
  }
  return map;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [,, jsonArg, orgSlug] = process.argv;
  if (!jsonArg) {
    console.error(
      "Usage: DATABASE_URL=... pnpm tsx apps/api/scripts/seed-appointments.ts <json> [org-slug]"
    );
    process.exit(1);
  }

  const appointments = JSON.parse(
    fs.readFileSync(path.resolve(jsonArg), "utf-8")
  ) as CleanAppointment[];
  console.log(`Loaded ${appointments.length} appointment record(s)`);

  // ── Organisation ────────────────────────────────────────────────────────────
  const org = orgSlug
    ? await prisma.organization.findUnique({ where: { slug: orgSlug } })
    : await prisma.organization.findFirst();
  if (!org) throw new Error(orgSlug ? `No org with slug "${orgSlug}"` : "No org found");
  console.log(`Organisation: ${org.name} (${org.id})\n`);

  // ── Lookup maps ──────────────────────────────────────────────────────────────
  const [dbClinics, dbAgencies, dbTypes, dbInterpreters] = await Promise.all([
    prisma.clinic.findMany({ where: { organization_id: org.id }, select: { id: true, name: true } }),
    prisma.agency.findMany({ where: { organization_id: org.id }, select: { id: true, name: true } }),
    prisma.appointmentType.findMany({ select: { id: true, name: true } }),
    prisma.interpreter.findMany({ where: { organization_id: org.id }, select: { id: true, name: true, phone: true } }),
  ]);

  const clinicMap      = buildNameMap(dbClinics);
  const agencyMap      = buildNameMap(dbAgencies);
  const typeMap        = buildNameMap(dbTypes);
  const interpreterMap = new Map<string, string>();
  for (const i of dbInterpreters) {
    const digits = i.phone.replace(/\D/g, "");
    if (digits) interpreterMap.set(digits, i.id);
  }

  // Track unresolved names for end-of-run report
  const unmatchedClinics  = new Set<string>();
  const unmatchedAgencies = new Set<string>();

  let created = 0, skipped = 0, errorCount = 0;

  for (const appt of appointments) {
    // ── Resolve clinic ─────────────────────────────────────────────────────
    const clinicId = clinicMap.get(norm(appt.clinic_name));
    if (!clinicId) {
      unmatchedClinics.add(appt.clinic_name);
      skipped++;
      continue;
    }

    // ── Resolve agency ─────────────────────────────────────────────────────
    const agencyId = agencyMap.get(norm(appt.agency_name));
    if (!agencyId) {
      unmatchedAgencies.add(appt.agency_name);
      skipped++;
      continue;
    }

    // ── Resolve appointment type ───────────────────────────────────────────
    const typeId = typeMap.get(norm(appt.appointment_type));
    if (!typeId) {
      console.warn(`  ⚠  Unknown appointment_type "${appt.appointment_type}" — skipping`);
      skipped++;
      continue;
    }

    // ── Resolve interpreter (optional) ─────────────────────────────────────
    const interpreterId = appt.interpreter_phone
      ? (interpreterMap.get(appt.interpreter_phone) ?? null)
      : null;

    // ── Upsert patient (name-based, case-insensitive) ──────────────────────
    // Patient model has no MRN field; deduplicate by name within the org.
    let patientId: string;
    try {
      const existingPatient = await prisma.patient.findFirst({
        where: {
          organization_id: org.id,
          name: { equals: appt.patient_name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (existingPatient) {
        patientId = existingPatient.id;
      } else {
        const newPatient = await prisma.patient.create({
          data: {
            organization_id: org.id,
            name:            appt.patient_name,
          },
        });
        patientId = newPatient.id;
      }
    } catch (e) {
      console.error(`  ✗  Patient upsert failed for "${appt.patient_name}":`, e);
      errorCount++;
      continue;
    }

    // ── Deduplicate: skip if same date_time + clinic + patient already exists ──
    const dateTime = new Date(appt.date_time);
    const existing = await prisma.appointment.findFirst({
      where: {
        organization_id: org.id,
        date_time:       dateTime,
        clinic_id:       clinicId,
        patient_id:      patientId,
      },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // ── Create appointment ─────────────────────────────────────────────────
    try {
      await prisma.appointment.create({
        data: {
          organization_id:           org.id,
          status:                    "completed",
          source:                    "csv_import",
          date_time:                 dateTime,
          duration_minutes:          appt.duration_minutes,
          type_id:                   typeId,
          language:                  appt.language,
          interpreter_type_required: appt.interpreter_type_required,
          interpreter_id:            interpreterId,
          clinic_id:                 clinicId,
          agency_id:                 agencyId,
          patient_id:                patientId,
          referring_physician:       appt.referring_physician ?? null,
          pre_auth_amount:           new Prisma.Decimal(appt.pre_auth_amount),
          pre_auth_mileage:          appt.pre_auth_mileage,
          po_number:                 appt.po_number ?? null,
          billing_interpreter:       appt.billing_interpreter ?? null,
        },
      });
      console.log(`  ✓  ${appt.date_time.slice(0, 16)}  ${appt.patient_name.padEnd(30)} @ ${appt.clinic_name}`);
      created++;
    } catch (e) {
      console.error(`  ✗  Failed: ${appt.patient_name} @ ${appt.clinic_name} ${appt.date_time}:`, e);
      errorCount++;
    }
  }

  // ── Final report ─────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Done.  Created: ${created}  |  Skipped: ${skipped}  |  Errors: ${errorCount}`);

  if (unmatchedClinics.size > 0) {
    console.log(`\n⚠  Unmatched clinic names (${unmatchedClinics.size}) — no DB record found:`);
    [...unmatchedClinics].sort().forEach(n => console.log(`   · "${n}"`));
  }

  if (unmatchedAgencies.size > 0) {
    console.log(`\n⚠  Unmatched agency names (${unmatchedAgencies.size}) — no DB record found:`);
    [...unmatchedAgencies].sort().forEach(n => console.log(`   · "${n}"`));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
