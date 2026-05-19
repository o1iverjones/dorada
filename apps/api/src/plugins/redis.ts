import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { Redis as IORedis } from "ioredis";
import type { Redis as RedisType } from "ioredis";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

export default fp(async (fastify: FastifyInstance) => {
  const redis = new IORedis(config.REDIS_URL, { lazyConnect: true, connectTimeout: 10000, maxRetriesPerRequest: null });

  redis.on("error", (err) => logger.error({ err }, "redis error"));

  await redis.connect();

  fastify.decorate("redis", redis);

  fastify.addHook("onClose", async () => {
    await redis.quit();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    redis: RedisType;
  }
}
