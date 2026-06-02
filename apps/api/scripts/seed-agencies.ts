#!/usr/bin/env tsx
/**
 * seed-agencies.ts
 *
 * Reads the clean JSON produced by scripts/transform-agencies.ts
 * and inserts every record into the database via Prisma.
 *
 * Usage (from repo root):
 *   DATABASE_URL="postgresql://..." \
 *   pnpm tsx apps/api/scripts/seed-agencies.ts <agencies-clean.json> [org-slug]
 *
 * If org-slug is omitted the script uses the first organisation it finds.
 * Existing records (matched by name + org, case-insensitive) are skipped.
 */

import fs   from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

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

const prisma = new PrismaClient();

async function main() {
  const [,, jsonArg, orgSlug] = process.argv;

  if (!jsonArg) {
    console.error(
      "Usage: DATABASE_URL=... pnpm tsx apps/api/scripts/seed-agencies.ts <agencies-clean.json> [org-slug]"
    );
    process.exit(1);
  }

  const jsonPath = path.resolve(jsonArg);
  const agencies = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as CleanAgency[];
  console.log(`Loaded ${agencies.length} agency/agencies from ${jsonPath}`);

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

  let created = 0;
  let skipped = 0;

  for (const agency of agencies) {
    if (!agency.name?.trim()) {
      console.log(`  ⚠  SKIP  — empty name, likely junk row`);
      skipped++;
      continue;
    }

    const existing = await prisma.agency.findFirst({
      where: {
        organization_id: org.id,
        name: { equals: agency.name, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existing) {
      console.log(`  ↷  SKIP  — ${agency.name} (already exists)`);
      skipped++;
      continue;
    }

    await prisma.agency.create({
      data: {
        organization_id:       org.id,
        name:                  agency.name,
        address:               agency.address               ?? null,
        city:                  agency.city                  ?? null,
        state:                 agency.state                 ?? null,
        zip_code:              agency.zip_code              ?? null,
        fax:                   agency.fax                   ?? null,
        phone:                 agency.phone                 ?? null,
        primary_contact_email: agency.primary_contact_email ?? null,
      },
    });

    console.log(`  ✓  CREATED — ${agency.name}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}  |  Skipped: ${skipped}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
