import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ORG_ID = "5e7dd14a-67ca-41b3-8dee-65091c90cd3e";

function cleanName(raw: string): string {
  return raw
    // "DOB 6/4/1993", "DOB: 06/09/61", "DOB:6/4/93"
    .replace(/\bDOB:?\s*[\d/]+/gi, "")
    // Standalone date patterns: "06/09/1961", "8/23/64", etc. (anywhere in string)
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, "")
    // Case numbers like "Caso 1234..." or "(Caso ...)"
    .replace(/\bCaso\s+\d+.*$/i, "")
    // Parenthetical codes like "(A2SXMTX)" or "(AM3QJTX)" — appointment ref IDs
    .replace(/\([A-Z0-9]{5,}\)/g, "")
    // Collapse multiple spaces / trim
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function main() {
  const patients = await prisma.patient.findMany({
    where: { organization_id: ORG_ID },
    select: { id: true, name: true },
  });

  console.log(`Found ${patients.length} patients`);

  let updated = 0;
  let unchanged = 0;

  for (const p of patients) {
    const cleaned = cleanName(p.name);
    if (cleaned === p.name) { unchanged++; continue; }
    console.log(`  "${p.name}" → "${cleaned}"`);
    await prisma.patient.update({ where: { id: p.id }, data: { name: cleaned } });
    updated++;
  }

  console.log(`\nDone — updated: ${updated}, unchanged: ${unchanged}`);
}

main().finally(() => prisma.$disconnect());
