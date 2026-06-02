#!/usr/bin/env tsx
/**
 * cleanup-seed.ts
 *
 * Wipes all interpreters (and their dependent records) for a given organisation.
 *
 * Usage:
 *   DATABASE_URL="..." pnpm tsx apps/api/scripts/cleanup-seed.ts <org-id-or-slug>
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [,, orgArg] = process.argv;
  if (!orgArg) {
    console.error("Usage: DATABASE_URL=... pnpm tsx apps/api/scripts/cleanup-seed.ts <org-id-or-slug>");
    process.exit(1);
  }

  const isUuid = /^[0-9a-f-]{36}$/i.test(orgArg);
  const org = isUuid
    ? await prisma.organization.findUnique({ where: { id: orgArg } })
    : await prisma.organization.findUnique({ where: { slug: orgArg } });

  if (!org) { console.error(`Organisation not found: ${orgArg}`); process.exit(1); }

  const count = await prisma.interpreter.count({ where: { organization_id: org.id } });
  console.log(`Found ${count} interpreter(s) under "${org.name}" (${org.id})`);
  if (count === 0) { console.log("Nothing to delete."); return; }

  console.log("Deleting dependent records then interpreters...");

  const id = org.id; // trusted internal value — safe to interpolate

  // Delete in FK order using raw SQL with direct interpolation
  const steps: [string, string][] = [
    ["Nullifying interpreter on appointments",  `UPDATE appointments SET interpreter_id = NULL WHERE interpreter_id IN (SELECT id FROM interpreters WHERE organization_id = '${id}')`],
    ["Deleting appointment offers",             `DELETE FROM appointment_offers WHERE interpreter_id IN (SELECT id FROM interpreters WHERE organization_id = '${id}')`],
    ["Deleting clinic interpreter blocks",      `DELETE FROM clinic_interpreter_blocks WHERE interpreter_id IN (SELECT id FROM interpreters WHERE organization_id = '${id}')`],
    ["Deleting refresh tokens",                 `DELETE FROM refresh_tokens WHERE interpreter_id IN (SELECT id FROM interpreters WHERE organization_id = '${id}')`],
    ["Deleting follow-up responses",            `DELETE FROM follow_up_responses WHERE interpreter_id IN (SELECT id FROM interpreters WHERE organization_id = '${id}')`],
    ["Deleting invoices",                       `DELETE FROM invoices WHERE interpreter_id IN (SELECT id FROM interpreters WHERE organization_id = '${id}')`],
    ["Deleting appointment media",              `DELETE FROM appointment_media WHERE interpreter_id IN (SELECT id FROM interpreters WHERE organization_id = '${id}')`],
    ["Deleting interpreters",                   `DELETE FROM interpreters WHERE organization_id = '${id}'`],
  ];

  for (const [label, sql] of steps) {
    const affected = await prisma.$executeRawUnsafe(sql);
    console.log(`  ✓ ${label} (${affected} row(s))`);
  }

  console.log(`\n✓ Done — ${count} interpreter(s) removed.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
