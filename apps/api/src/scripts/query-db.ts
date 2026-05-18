import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const deleted = await prisma.appointment.deleteMany({
    where: { organization_id: "5e7dd14a-67ca-41b3-8dee-65091c90cd3e", type_id: "f3b29d2b-9460-4049-8f19-d6fce3c74e1d" },
  });
  console.log(`Deleted ${deleted.count} appointments`);
}
main().finally(() => prisma.$disconnect());
