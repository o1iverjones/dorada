import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
  });
});
