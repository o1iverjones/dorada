import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const ORG_ID = "5e7dd14a-67ca-41b3-8dee-65091c90cd3e";

async function main() {
  const patients = await prisma.patient.findMany({
    where: { organization_id: ORG_ID },
    select: { id: true, name: true },
  });
  let updated = 0;
  for (const p of patients) {
    const cleaned = p.name.replace(/\s*[-:]+\s*$/, "").replace(/\s{2,}/g, " ").trim();
    if (cleaned !== p.name) {
      console.log(`"${p.name}" → "${cleaned}"`);
      await prisma.patient.update({ where: { id: p.id }, data: { name: cleaned } });
      updated++;
    }
  }
  console.log(`Fixed ${updated} trailing artifacts`);
}

main().finally(() => prisma.$disconnect());
