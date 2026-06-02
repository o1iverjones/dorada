#!/usr/bin/env tsx
/**
 * cleanup-seguros-from-agencies.ts
 *
 * Removes wrongly-seeded insurance company records (SEGUROS.xlsx) from the
 * agencies table, identified by name match against the transform output JSON.
 *
 * Usage:
 *   DATABASE_URL="..." pnpm tsx apps/api/scripts/cleanup-seguros-from-agencies.ts <agencies-clean.json>
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [,, jsonArg] = process.argv;
  if (!jsonArg) {
    console.error("Usage: DATABASE_URL=... pnpm tsx apps/api/scripts/cleanup-seguros-from-agencies.ts <agencies-clean.json>");
    process.exit(1);
  }

  const records = JSON.parse(fs.readFileSync(path.resolve(jsonArg), "utf-8")) as { name: string }[];
  const names = records.map(r => r.name.trim().toLowerCase());
  console.log(`Loaded ${names.length} SEGUROS names to remove from agencies table`);

  // Find agencies whose names match SEGUROS records (case-insensitive)
  const toDelete = await prisma.agency.findMany({
    where: { name: { in: records.map(r => r.name) } },
    select: { id: true, name: true },
  });

  console.log(`Found ${toDelete.length} matching records in agencies table`);
  if (toDelete.length === 0) { console.log("Nothing to delete."); return; }

  const ids = toDelete.map(r => r.id);

  // agency_id is NOT NULL on appointments — delete test appointments that reference
  // these wrongly-seeded agencies (they are all test data anyway)
  const idList = ids.map(id => `'${id}'`).join(",");

  // Delete dependent appointment records first (FK chain)
  await prisma.$executeRawUnsafe(`DELETE FROM appointment_notes     WHERE appointment_id IN (SELECT id FROM appointments WHERE agency_id IN (${idList}))`);
  await prisma.$executeRawUnsafe(`DELETE FROM appointment_offers    WHERE appointment_id IN (SELECT id FROM appointments WHERE agency_id IN (${idList}))`);
  await prisma.$executeRawUnsafe(`DELETE FROM appointment_activities WHERE appointment_id IN (SELECT id FROM appointments WHERE agency_id IN (${idList}))`);
  await prisma.$executeRawUnsafe(`DELETE FROM follow_up_responses   WHERE appointment_id IN (SELECT id FROM appointments WHERE agency_id IN (${idList}))`);
  await prisma.$executeRawUnsafe(`DELETE FROM appointment_media     WHERE appointment_id IN (SELECT id FROM appointments WHERE agency_id IN (${idList}))`);
  await prisma.$executeRawUnsafe(`DELETE FROM invoices              WHERE appointment_id IN (SELECT id FROM appointments WHERE agency_id IN (${idList}))`);
  const deletedAppts = await prisma.$executeRawUnsafe(
    `DELETE FROM appointments WHERE agency_id IN (${idList})`
  );
  if (deletedAppts > 0) console.log(`  Deleted ${deletedAppts} test appointment(s) referencing these agencies`);

  const deleted = await prisma.agency.deleteMany({ where: { id: { in: ids } } });
  console.log(`\n✓ Deleted ${deleted.count} record(s) from agencies`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
