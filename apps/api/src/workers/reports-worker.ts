/**
 * Standalone entry point for the report generation worker.
 * Does not depend on firebase-admin or twilio.
 * Run with: pnpm dev:worker
 */
import { PrismaClient } from "@prisma/client";
import { createReportGenerationWorker } from "./report-generation.worker.js";

const prisma = new PrismaClient();
const reportWorker = createReportGenerationWorker(prisma);

function shutdown() {
  console.log("Shutting down report worker…");
  reportWorker.close().then(() => process.exit(0)).catch(() => process.exit(1));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("✅ Report worker started");
