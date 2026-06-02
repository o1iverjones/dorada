#!/usr/bin/env tsx
/**
 * seed-interpreters.ts
 *
 * Reads the clean JSON produced by scripts/transform-interpreters.ts
 * and upserts every record into the database via Prisma.
 *
 * Usage (from repo root):
 *   DATABASE_URL="postgresql://..." \
 *   pnpm tsx apps/api/scripts/seed-interpreters.ts <interpreters-clean.json> [org-slug]
 *
 * If org-slug is omitted the script uses the first organisation it finds.
 * Existing records (matched by phone + org) are skipped, not overwritten.
 */

import fs   from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CleanInterpreter {
  name:               string;
  phone:              string;
  email:              string | null;
  type:               string;
  languages:          string[];
  payment_method:     string | null;
  address_line1:      string | null;
  address_line2:      string | null;
  city:               string | null;
  state:              string | null;
  zip_code:           string | null;
  emergency_contact:  { name: string; phone: string } | null;
  notes:              string | null;
  priority:           string | null;
  preferred_cities:   string[];
  pay_rate:           number | null;
  pay_rate_certified: number | null;
  extra_rates:        Record<string, number> | null;
  is_active:          boolean;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function main() {
  const [,, jsonArg, orgSlug] = process.argv;

  if (!jsonArg) {
    console.error(
      "Usage: DATABASE_URL=... pnpm tsx apps/api/scripts/seed-interpreters.ts <interpreters-clean.json> [org-slug]"
    );
    process.exit(1);
  }

  // ── Load JSON ──────────────────────────────────────────────────────────────
  const jsonPath     = path.resolve(jsonArg);
  const interpreters = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as CleanInterpreter[];
  console.log(`Loaded ${interpreters.length} interpreter(s) from ${jsonPath}`);

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

  for (const interp of interpreters) {
    // Strip non-digits from phone (transform script already does this,
    // but be safe in case the JSON was hand-edited)
    const phone = interp.phone.replace(/\D/g, "") || "0000000000";

    // Skip if a record with this phone already exists for this org
    const existing = await prisma.interpreter.findFirst({
      where: { organization_id: org.id, phone },
      select: { id: true },
    });

    if (existing) {
      console.log(`  ↷  SKIP  — ${interp.name} (${phone}) already exists`);
      skipped++;
      continue;
    }

    await prisma.interpreter.create({
      data: {
        organization_id:         org.id,
        name:                    interp.name,
        phone,
        email:                   interp.email          ?? null,
        type:                    interp.type,
        languages:               interp.languages,
        payment_method:          interp.payment_method ?? null,
        address_line1:           interp.address_line1  ?? null,
        address_line2:           interp.address_line2  ?? null,
        city:                    interp.city           ?? null,
        state:                   interp.state          ?? null,
        zip_code:                interp.zip_code       ?? null,
        emergency_contact_name:  interp.emergency_contact?.name  ?? null,
        emergency_contact_phone: interp.emergency_contact?.phone ?? null,
        notes:                   interp.notes          ?? null,
        priority:                interp.priority       ?? null,
        preferred_cities:        interp.preferred_cities,
        pay_rate:                interp.pay_rate           != null ? interp.pay_rate           : null,
        pay_rate_certified:      interp.pay_rate_certified != null ? interp.pay_rate_certified : null,
        extra_rates:             interp.extra_rates    ?? null,
        is_active:               interp.is_active,
      },
    });

    console.log(`  ✓  CREATED — ${interp.name} (${phone})`);
    created++;
  }

  console.log(`\nDone. Created: ${created}  |  Skipped (already exist): ${skipped}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
