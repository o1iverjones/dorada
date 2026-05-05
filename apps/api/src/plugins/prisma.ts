import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}
