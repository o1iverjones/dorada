import { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: [
      { level: "query", emit: "event" },
      { level: "error", emit: "stdout" },
      { level: "warn", emit: "stdout" },
    ],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__prisma = prisma;
}

prisma.$on("query" as never, (e: { query: string; duration: number }) => {
  if (process.env["LOG_LEVEL"] === "trace") {
    logger.trace({ query: e.query, duration: e.duration }, "db query");
  }
});
