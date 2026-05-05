import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import Redis from "ioredis";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

export default fp(async (fastify: FastifyInstance) => {
  const redis = new Redis(config.REDIS_URL, { lazyConnect: true });

  redis.on("error", (err) => logger.error({ err }, "redis error"));

  await redis.connect();

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}
