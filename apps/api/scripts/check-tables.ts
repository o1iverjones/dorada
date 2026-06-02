#!/usr/bin/env tsx
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const [ag, ic] = await Promise.all([p.agency.count(), p.insuranceCompany.count()]);
  console.log("agencies:", ag);
  console.log("insurance_companies:", ic);
}
main().finally(() => p.$disconnect());
