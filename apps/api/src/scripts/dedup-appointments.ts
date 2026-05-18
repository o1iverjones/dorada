import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const ORG_ID = "5e7dd14a-67ca-41b3-8dee-65091c90cd3e";

async function main() {
  // Find all appointments, group by patient_id + date_time + clinic_id
  const appts = await prisma.appointment.findMany({
    where: { organization_id: ORG_ID },
    select: { id: true, patient_id: true, date_time: true, clinic_id: true, interpreter_id: true, created_at: true },
    orderBy: { created_at: "asc" },
  });

  // Group by composite key
  const groups = new Map<string, typeof appts>();
  for (const a of appts) {
    const key = `${a.patient_id}|${a.date_time.toISOString()}|${a.clinic_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  const duplicateGroups = [...groups.values()].filter(g => g.length > 1);
  console.log(`Duplicate groups: ${duplicateGroups.length}`);

  const toDelete: string[] = [];
  for (const group of duplicateGroups) {
    // Keep the one with an interpreter assigned (if any), else keep the oldest
    const withInterp = group.find(a => a.interpreter_id !== null);
    const keep = withInterp ?? group[0];
    for (const a of group) {
      if (a.id !== keep.id) toDelete.push(a.id);
    }
  }

  console.log(`Deleting ${toDelete.length} duplicate appointments...`);
  const { count } = await prisma.appointment.deleteMany({ where: { id: { in: toDelete } } });
  console.log(`Deleted ${count}. Remaining: ${await prisma.appointment.count({ where: { organization_id: ORG_ID } })}`);
}

main().finally(() => prisma.$disconnect());
