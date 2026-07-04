import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";
import { withTenantGuard } from "./tenantGuard.js";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Base client owns event hooks ($on is not carried onto $extends clients).
const baseClient: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: [
      { level: "query", emit: "event" },
      { level: "error", emit: "stdout" },
      { level: "warn", emit: "stdout" },
    ],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__prisma = baseClient;
}

baseClient.$on("query" as never, (e: { query: string; duration: number }) => {
  if (process.env["LOG_LEVEL"] === "trace") {
    logger.trace({ query: e.query, duration: e.duration }, "db query");
  }
});

/** App-wide client: list/bulk queries are tenant-scoped inside authenticated requests. */
export const prisma: PrismaClient = withTenantGuard(baseClient);
