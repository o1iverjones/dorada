import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { extname } from "path";
import { randomUUID } from "crypto";
import { authenticateAdmin } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import type { JwtPayload } from "../../middleware/auth.js";
import { listUsers, createUser, updateUser, listRoles, createRole } from "./admin-users.service.js";
import { writeActivityLog } from "../../lib/activityLog.js";
import { sendEmail, welcomeAdminEmail } from "../../lib/email.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";

const CreateUserBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(10),
  role_id: z.string().uuid().optional(),
});

const UpdateUserBody = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(10).optional(),
  role_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
});

const UpdateProfileBody = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullish(),
  phone_ext: z.string().nullish(),
});

const CreateRoleBody = z.object({
  name: z.string().min(1),
  permissions: z.array(z.string()).default([]),
});

export default async function adminUsersRoutes(fastify: FastifyInstance) {
  const manage = [authenticateAdmin, requirePermission("manage_admin_users")];

  fastify.get("/admin-users", { preHandler: [authenticateAdmin] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await listUsers(payload.organization_id, fastify.prisma));
  });

  fastify.post("/admin-users", { preHandler: manage }, async (req, reply) => {
    const body = CreateUserBody.parse(req.body);
    const payload = req.user as JwtPayload;
    const user = await createUser(body, payload.organization_id, payload.permissions ?? [], fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "admin_user", entityId: user.id, entityName: user.name, action: "created", adminId: payload.sub, adminName: payload.name ?? "Admin" });

    // Send welcome email with login credentials (fire-and-forget — don't block response)
    const loginUrl = `${config.APP_URL}/login`;
    sendEmail(welcomeAdminEmail(user.name, user.email, body.password, loginUrl)).catch((err) => {
      logger.error({ err, userId: user.id }, "Failed to send welcome email to new admin user");
    });

    return reply.status(201).send(user);
  });

  fastify.patch("/admin-users/:id", { preHandler: manage }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateUserBody.parse(req.body);
    const payload = req.user as JwtPayload;
    const user = await updateUser(id, body, payload.organization_id, payload.permissions ?? [], fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "admin_user", entityId: id, entityName: user.name, action: "updated", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.send(user);
  });

  fastify.get("/roles", { preHandler: [authenticateAdmin] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    return reply.send(await listRoles(payload.organization_id, fastify.prisma));
  });

  fastify.post("/roles", { preHandler: manage }, async (req, reply) => {
    const body = CreateRoleBody.parse(req.body);
    const payload = req.user as JwtPayload;
    const role = await createRole(body, payload.organization_id, fastify.prisma);
    await writeActivityLog(fastify.prisma, { organizationId: payload.organization_id, entityType: "admin_user", entityId: role.id, entityName: role.name, action: "role_created", adminId: payload.sub, adminName: payload.name ?? "Admin" });
    return reply.status(201).send(role);
  });

  // PATCH /admin-users/me/profile — update own profile (name, phone, phone_ext)
  fastify.patch("/admin-users/me/profile", { preHandler: [authenticateAdmin] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    const body = UpdateProfileBody.parse(req.body);
    const user = await fastify.prisma.user.update({
      where: { id: payload.sub },
      data: {
        ...(body.name ? { name: body.name } : {}),
        phone: body.phone ?? null,
        phone_ext: body.phone_ext ?? null,
      },
      select: { id: true, name: true, email: true, phone: true, phone_ext: true, profile_picture_url: true },
    });
    return reply.send(user);
  });

  // POST /admin-users/me/avatar — upload profile picture
  fastify.post("/admin-users/me/avatar", { preHandler: [authenticateAdmin] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    const data = await req.file({ limits: { fileSize: 5 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: { code: "NO_FILE", message: "No file uploaded" } });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const ext = extname(data.filename || "") || (data.mimetype === "image/png" ? ".png" : data.mimetype === "image/webp" ? ".webp" : ".jpg");
    const filename = `avatars/${payload.sub}/${randomUUID()}${ext}`;

    // Store as a data URL or upload to GCS if configured
    let publicUrl: string;
    if (config.GCP_PROJECT_ID) {
      const { uploadBuffer } = await import("../../integrations/gcs.js");
      await uploadBuffer(filename, buffer, data.mimetype);
      // Use a public GCS URL
      publicUrl = `https://storage.googleapis.com/${config.GCS_BUCKET}/${filename}`;
    } else {
      // Dev fallback: store as base64 data URL
      publicUrl = `data:${data.mimetype};base64,${buffer.toString("base64")}`;
    }

    const user = await fastify.prisma.user.update({
      where: { id: payload.sub },
      data: { profile_picture_url: publicUrl },
      select: { id: true, profile_picture_url: true },
    });

    return reply.send(user);
  });

  // GET /admin-users/me — get current user's profile
  fastify.get("/admin-users/me", { preHandler: [authenticateAdmin] }, async (req, reply) => {
    const payload = req.user as JwtPayload;
    const user = await fastify.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, phone: true, phone_ext: true, profile_picture_url: true },
    });
    return reply.send(user);
  });
}
