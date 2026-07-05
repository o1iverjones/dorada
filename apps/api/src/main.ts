import { buildServer } from "./server.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

process.on("uncaughtException", (err) => {
  // Unknown synchronous state — crash and let Railway restart us.
  process.stderr.write(`uncaughtException: ${err.message}\n${err.stack ?? ""}\n`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  // A stray rejected promise (e.g. an unawaited fire-and-forget) is not worth
  // dropping every in-flight request and socket for. Log loudly, keep serving.
  logger.error({ err: reason }, "unhandledRejection — continuing");
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
