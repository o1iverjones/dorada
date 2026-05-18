import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const interps = await prisma.interpreter.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
console.log("Total interpreters:", interps.length);
interps.forEach(i => console.log(i.id, i.name));
await prisma.$disconnect();
