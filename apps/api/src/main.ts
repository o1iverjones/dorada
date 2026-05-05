import { buildServer } from "./server.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";

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
