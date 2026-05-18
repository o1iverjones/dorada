import type { FastifyRequest, FastifyReply } from "fastify";
import type { Permission } from "@dorada/types";
import { ForbiddenError } from "../lib/errors.js";
import type { JwtPayload } from "./auth.js";

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const payload = request.user as JwtPayload;
    if (!payload.permissions?.includes(permission)) {
      const error = new ForbiddenError("FORBIDDEN", `Permission required: ${permission}`);
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }
  };
}
