import { z } from "zod";
import { UuidSchema } from "./common.js";

export const MessageSchema = z.object({
  id: UuidSchema,
  body: z.string(),
  sender_type: z.enum(["admin", "interpreter"]),
  sender: z.object({ id: UuidSchema, name: z.string() }),
  sent_at: z.string().datetime(),
  read_at: z.string().datetime().nullable(),
});

export const ConversationSchema = z.object({
  id: UuidSchema,
  interpreter: z.object({ id: UuidSchema, name: z.string() }),
  last_message: z.object({
    body: z.string(),
    sent_at: z.string().datetime(),
    sender_type: z.enum(["admin", "interpreter"]),
  }).nullable(),
  unread_count: z.number().int().nonnegative(),
});

export const SendMessageBodySchema = z.object({
  body: z.string().min(1).max(2000),
});

export const ConversationListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const MessageListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  since: z.string().datetime().optional(),
});

export type Message = z.infer<typeof MessageSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type SendMessageBody = z.infer<typeof SendMessageBodySchema>;
export type ConversationListQuery = z.infer<typeof ConversationListQuerySchema>;
export type MessageListQuery = z.infer<typeof MessageListQuerySchema>;
