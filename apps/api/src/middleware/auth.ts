import type { FastifyRequest, FastifyReply } from "fastify";
import { UnauthorizedError } from "../lib/errors.js";

export interface JwtPayload {
  sub: string;
  type: "admin" | "interpreter";
  organization_id: string;
  role_id?: string;
  permissions?: string[];
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify<JwtPayload>();
  } catch {
    const error = new UnauthorizedError("UNAUTHORIZED", "Invalid or missing token");
    await reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
}

export async function authenticateInterpreter(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticate(request, reply);
  const payload = request.user as JwtPayload;
  if (payload.type !== "interpreter") {
    const error = new UnauthorizedError("UNAUTHORIZED", "Interpreter authentication required");
    await reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
}

export async function authenticateAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await authenticate(request, reply);
  const payload = request.user as JwtPayload;
  if (payload.type !== "admin") {
    const error = new UnauthorizedError("UNAUTHORIZED", "Admin authentication required");
    await reply.status(error.statusCode).send({ error: { code: error.code, message: error.message } });
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user: JwtPayload;
  }
}
