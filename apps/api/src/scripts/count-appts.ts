import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const ORG_ID = "5e7dd14a-67ca-41b3-8dee-65091c90cd3e";
const total = await prisma.appointment.count({ where: { organization_id: ORG_ID } });
const assigned = await prisma.appointment.count({ where: { organization_id: ORG_ID, interpreter_id: { not: null } } });
const unassigned = total - assigned;
console.log(`Total: ${total}, Assigned: ${assigned}, Unassigned: ${unassigned}`);
await prisma.$disconnect();
