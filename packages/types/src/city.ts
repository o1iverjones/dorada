import { z } from "zod";
import { UuidSchema } from "./common.js";

export const CitySchema = z.object({
  id: UuidSchema,
  name: z.string(),
  created_at: z.string().datetime(),
});

export const CreateCityBodySchema = z.object({
  name: z.string().min(1).max(100),
});

export const UpdateCityBodySchema = z.object({
  name: z.string().min(1).max(100),
});

export type City = z.infer<typeof CitySchema>;
export type CreateCityBody = z.infer<typeof CreateCityBodySchema>;
export type UpdateCityBody = z.infer<typeof UpdateCityBodySchema>;
