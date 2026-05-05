import { z } from "zod";
import { PermissionSchema, UuidSchema } from "./common.js";

export const RoleSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  permissions: z.array(PermissionSchema),
  is_system: z.boolean(),
});

export const AdminUserSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  email: z.string().email(),
  role: z.object({ id: UuidSchema, name: z.string() }),
  permissions: z.array(PermissionSchema),
  mfa_enabled: z.boolean(),
  is_active: z.boolean(),
  language: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateAdminUserBodySchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(10),
  role_id: UuidSchema,
  language: z.string().min(2).max(10).default("en"),
});

export const UpdateAdminUserBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  role_id: UuidSchema.optional(),
  language: z.string().min(2).max(10).optional(),
});

export const CreateRoleBodySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(PermissionSchema),
});

export const UpdateRoleBodySchema = CreateRoleBodySchema.partial();

export const AdminNotificationPreferencesSchema = z.object({
  follow_up_notification: z.object({
    push: z.boolean(),
    email_immediate: z.boolean(),
    email_digest: z.boolean(),
    email_digest_times: z.array(z.string().regex(/^\d{2}:\d{2}$/)),
  }),
  language: z.string().min(2).max(10).optional(),
});

export type Role = z.infer<typeof RoleSchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export type CreateAdminUserBody = z.infer<typeof CreateAdminUserBodySchema>;
export type UpdateAdminUserBody = z.infer<typeof UpdateAdminUserBodySchema>;
export type CreateRoleBody = z.infer<typeof CreateRoleBodySchema>;
export type UpdateRoleBody = z.infer<typeof UpdateRoleBodySchema>;
export type AdminNotificationPreferences = z.infer<typeof AdminNotificationPreferencesSchema>;
