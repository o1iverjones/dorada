import { buildServer } from "./server.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

process.on("uncaughtException", (err) => {
  process.stderr.write(`[startup] uncaughtException: ${err.message}\n${err.stack ?? ""}\n`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  process.stderr.write(`[startup] unhandledRejection: ${String(reason)}\n`);
  process.exit(1);
});

async function start() {
  const server = await buildServer();
  try {
    await server.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info(`Server listening on port ${config.PORT}`);
  } catch (err) {
    logger.error({ err }, "failed to start server");
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  process.exit(0);
});

await start();
