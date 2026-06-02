#!/usr/bin/env tsx
/**
 * seed-clinics.ts
 *
 * Reads the clean JSON produced by scripts/transform-clinics.ts
 * and upserts every record into the database via Prisma.
 *
 * Usage (from repo root):
 *   DATABASE_URL="postgresql://..." \
 *   pnpm tsx apps/api/scripts/seed-clinics.ts <clinics-clean.json> [org-slug]
 *
 * If org-slug is omitted the script uses the first organisation it finds.
 * Existing records (matched by name + org, case-insensitive) are skipped.
 */

import fs   from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

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

// ─── Main ─────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function main() {
  const [,, jsonArg, orgSlug] = process.argv;

  if (!jsonArg) {
    console.error(
      "Usage: DATABASE_URL=... pnpm tsx apps/api/scripts/seed-clinics.ts <clinics-clean.json> [org-slug]"
    );
    process.exit(1);
  }

  // ── Load JSON ──────────────────────────────────────────────────────────────
  const jsonPath = path.resolve(jsonArg);
  const clinics  = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as CleanClinic[];
  console.log(`Loaded ${clinics.length} clinic(s) from ${jsonPath}`);

  // ── Resolve organisation ───────────────────────────────────────────────────
  const org = orgSlug
    ? await prisma.organization.findUnique({ where: { slug: orgSlug } })
    : await prisma.organization.findFirst();

  if (!org) {
    throw new Error(
      orgSlug
        ? `No organisation with slug "${orgSlug}" found.`
        : "No organisation found in DB. Pass an org slug as the second argument."
    );
  }
  console.log(`Organisation: ${org.name} (${org.id})\n`);

  // ── Import ─────────────────────────────────────────────────────────────────
  let created = 0;
  let skipped = 0;

  for (const clinic of clinics) {
    // Skip if a clinic with the same name (case-insensitive) already exists for this org
    const existing = await prisma.clinic.findFirst({
      where: {
        organization_id: org.id,
        name: { equals: clinic.name, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existing) {
      console.log(`  ↷  SKIP  — ${clinic.name} (already exists)`);
      skipped++;
      continue;
    }

    await prisma.clinic.create({
      data: {
        organization_id:       org.id,
        name:                  clinic.name,
        address:               clinic.address        ?? null,
        address_line2:         clinic.address_line2  ?? null,
        city:                  clinic.city           ?? null,
        state:                 clinic.state          ?? null,
        zip_code:              clinic.zip_code       ?? null,
        location_lat:          clinic.location_lat   ?? null,
        location_lng:          clinic.location_lng   ?? null,
        parking:               clinic.parking               ?? null,
        parking_instructions:  clinic.parking_instructions  ?? null,
        phone:                 clinic.phone                 ?? null,
        primary_contact_name:  clinic.primary_contact_name  ?? null,
        primary_contact_phone: clinic.primary_contact_phone ?? null,
        primary_contact_email: clinic.primary_contact_email ?? null,
        billing_model:         clinic.billing_model,
        is_active:             clinic.is_active,
      },
    });

    console.log(`  ✓  CREATED — ${clinic.name}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}  |  Skipped (already exist): ${skipped}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
