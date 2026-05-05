import fp from "fastify-plugin";
import fastifyMultipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 5,
    },
  });
});
