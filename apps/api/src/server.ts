import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { AppError } from "./lib/errors.js";
import prismaPlugin from "./plugins/prisma.js";
import redisPlugin from "./plugins/redis.js";
import jwtPlugin from "./plugins/jwt.js";
import multipartPlugin from "./plugins/multipart.js";
import socketPlugin from "./plugins/socket.js";
import { registerRoutes } from "./routes/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
  const fastify = Fastify({
    logger,
    ajv: { customOptions: { strict: false } },
  });

  await fastify.register(fastifyHelmet);
  await fastify.register(fastifyCors, {
    origin: config.CORS_ORIGIN ? config.CORS_ORIGIN.split(",").map((o) => o.trim()) : true,
    credentials: true,
  });
  await fastify.register(fastifyRateLimit, {
    max: 300,
    timeWindow: "1 minute",
    redis: undefined, // attached after redis plugin loads
  });

  await fastify.register(fastifyStatic, {
    root: join(__dirname, "..", "uploads"),
    prefix: "/uploads/",
    decorateReply: false,
  });

  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(multipartPlugin);
  await fastify.register(socketPlugin);

  await fastify.register(registerRoutes, { prefix: "/api/v1" });

  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }
    logger.error({ err: error }, "unhandled error");
    return reply
      .status(500)
      .send({ error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" } });
  });

  fastify.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  return fastify;
}
