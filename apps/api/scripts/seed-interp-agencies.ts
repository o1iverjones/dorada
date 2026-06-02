#!/usr/bin/env tsx
/**
 * seed-interp-agencies.ts
 *
 * Seeds interpreting/subcontractor agencies from the JSON produced by
 * scripts/transform-interp-agencies.ts into the agencies table.
 *
 * Usage (from repo root):
 *   DATABASE_URL="postgresql://..." \
 *   pnpm tsx apps/api/scripts/seed-interp-agencies.ts <interp-agencies-clean.json> [org-slug]
 *
 * Existing records (matched by name + org, case-insensitive) are skipped.
 */

import fs   from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

interface CleanAgency {
  name:                  string;
  notes:                 string | null;
  phone:                 string | null;
  primary_contact_name:  string | null;
  primary_contact_phone: string | null;
  primary_contact_email: string | null;
}

const prisma = new PrismaClient();

async function main() {
  const [,, jsonArg, orgSlug] = process.argv;
  if (!jsonArg) {
    console.error("Usage: DATABASE_URL=... pnpm tsx apps/api/scripts/seed-interp-agencies.ts <json> [org-slug]");
    process.exit(1);
  }

  const agencies = JSON.parse(fs.readFileSync(path.resolve(jsonArg), "utf-8")) as CleanAgency[];
  console.log(`Loaded ${agencies.length} agency record(s)`);

  const org = orgSlug
    ? await prisma.organization.findUnique({ where: { slug: orgSlug } })
    : await prisma.organization.findFirst();
  if (!org) throw new Error(orgSlug ? `No org with slug "${orgSlug}"` : "No org found");
  console.log(`Organisation: ${org.name} (${org.id})\n`);

  let created = 0, skipped = 0;

  for (const agency of agencies) {
    if (!agency.name?.trim()) { skipped++; continue; }

    const existing = await prisma.agency.findFirst({
      where: { organization_id: org.id, name: { equals: agency.name, mode: "insensitive" } },
      select: { id: true },
    });

    if (existing) {
      console.log(`  ↷  SKIP  — ${agency.name}`);
      skipped++;
      continue;
    }

    await prisma.agency.create({
      data: {
        organization_id:       org.id,
        name:                  agency.name,
        notes:                 agency.notes                 ?? null,
        phone:                 agency.phone                 ?? null,
        primary_contact_name:  agency.primary_contact_name  ?? null,
        primary_contact_phone: agency.primary_contact_phone ?? null,
        primary_contact_email: agency.primary_contact_email ?? null,
      },
    });

    console.log(`  ✓  CREATED — ${agency.name}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}  |  Skipped: ${skipped}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
