import type { PrismaClient } from "@prisma/client";
import type { SendMessageBody } from "@dorada/types";
import { NotFoundError, ForbiddenError } from "../../lib/errors.js";
import { normalizeFileRef, resolveFileUrl } from "../../integrations/r2.js";

export async function listConversations(
  organizationId: string,
  userId: string,
  isAdmin: boolean,
  query: { cursor?: string; limit: number },
  prisma: PrismaClient,
) {
  const interpreters = await prisma.interpreter.findMany({
    where: {
      organization_id: organizationId,
      is_active: true,
      ...(isAdmin ? {} : { id: userId }),
    },
    orderBy: { name: "asc" },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: {
      sent_messages: {
        orderBy: { sent_at: "desc" },
        take: 1,
      },
    },
  });

  const hasMore = interpreters.length > query.limit;
  const data = hasMore ? interpreters.slice(0, -1) : interpreters;

  // One grouped query for all unread counts (was one count query per
  // interpreter — N+1 on every conversations poll).
  const unreadCounts = await prisma.message.groupBy({
    by: ["interpreter_id"],
    where: {
      organization_id: organizationId,
      interpreter_id: { in: data.map((i) => i.id) },
      read_at: null,
      sender_type: isAdmin ? "interpreter" : "admin",
    },
    _count: { _all: true },
  });
  const unreadByInterpreter = new Map(unreadCounts.map((c) => [c.interpreter_id, c._count._all]));

  const conversations = data.map((interpreter) => {
      const last = interpreter.sent_messages[0];
      return {
        id: interpreter.id,
        interpreter: { id: interpreter.id, name: interpreter.name },
        last_message: last
          ? { body: last.body, sent_at: last.sent_at.toISOString(), sender_type: last.sender_type }
          : null,
        unread_count: unreadByInterpreter.get(interpreter.id) ?? 0,
      };
  });

  return {
    data: conversations,
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

export async function listMessages(
  interpreterId: string,
  requesterId: string,
  isAdmin: boolean,
  organizationId: string,
  query: { cursor?: string; limit: number; since?: string },
  prisma: PrismaClient,
) {
  if (!isAdmin && requesterId !== interpreterId) {
    throw new ForbiddenError("UNAUTHORIZED_CONVERSATION", "Cannot access another interpreter's conversation");
  }

  const interpreter = await prisma.interpreter.findFirst({
    where: { id: interpreterId, organization_id: organizationId },
  });
  if (!interpreter) throw new NotFoundError("CONVERSATION_NOT_FOUND", "Interpreter not found");

  // `since` mode: return only new messages in ascending order — no cursor pagination needed
  if (query.since) {
    const messages = await prisma.message.findMany({
      where: {
        organization_id: organizationId,
        interpreter_id: interpreterId,
        sent_at: { gt: new Date(query.since) },
      },
      orderBy: { sent_at: "asc" },
      include: { sender_user: { select: { id: true, name: true } } },
    });
    return {
      data: await Promise.all(messages.map(async (m) => ({
        id: m.id,
        body: m.body,
        image_url: await resolveFileUrl(m.image_url),
        sender_type: m.sender_type,
        sender: m.sender_type === "admin" && m.sender_user
          ? { id: m.sender_user.id, name: m.sender_user.name }
          : { id: interpreter.id, name: interpreter.name },
        sent_at: m.sent_at.toISOString(),
        read_at: m.read_at?.toISOString() ?? null,
      }))),
      pagination: { next_cursor: null, has_more: false },
    };
  }

  // Initial load: latest messages in descending order with cursor pagination
  const messages = await prisma.message.findMany({
    where: {
      organization_id: organizationId,
      interpreter_id: interpreterId,
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    },
    take: query.limit + 1,
    orderBy: { sent_at: "desc" },
    include: { sender_user: { select: { id: true, name: true } } },
  });

  const hasMore = messages.length > query.limit;
  const data = hasMore ? messages.slice(0, -1) : messages;

  return {
    data: await Promise.all(data.map(async (m) => ({
      id: m.id,
      body: m.body,
      image_url: await resolveFileUrl(m.image_url),
      sender_type: m.sender_type,
      sender: m.sender_type === "admin" && m.sender_user
        ? { id: m.sender_user.id, name: m.sender_user.name }
        : { id: interpreter.id, name: interpreter.name },
      sent_at: m.sent_at.toISOString(),
      read_at: m.read_at?.toISOString() ?? null,
    }))),
    pagination: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, has_more: hasMore },
  };
}

export async function searchMessages(
  organizationId: string,
  q: string,
  prisma: PrismaClient,
) {
  const messages = await prisma.message.findMany({
    where: {
      organization_id: organizationId,
      body: { contains: q, mode: "insensitive" },
    },
    orderBy: { sent_at: "desc" },
    take: 50,
    include: {
      interpreter: { select: { id: true, name: true } },
      sender_user: { select: { id: true, name: true } },
    },
  });

  return messages.map((m) => ({
    id: m.id,
    body: m.body,
    sender_type: m.sender_type,
    sender: m.sender_type === "admin" && m.sender_user
      ? { id: m.sender_user.id, name: m.sender_user.name }
      : { id: m.interpreter.id, name: m.interpreter.name },
    sent_at: m.sent_at.toISOString(),
    read_at: m.read_at?.toISOString() ?? null,
    interpreter: { id: m.interpreter.id, name: m.interpreter.name },
  }));
}

export async function sendMessage(
  interpreterId: string,
  senderId: string,
  isAdmin: boolean,
  organizationId: string,
  body: SendMessageBody,
  prisma: PrismaClient,
) {
  if (!isAdmin && senderId !== interpreterId) {
    throw new ForbiddenError("UNAUTHORIZED_CONVERSATION", "Cannot send to another interpreter's thread");
  }

  const interpreter = await prisma.interpreter.findFirst({
    where: { id: interpreterId, organization_id: organizationId },
  });
  if (!interpreter) throw new NotFoundError("CONVERSATION_NOT_FOUND", "Interpreter not found");

  return prisma.message.create({
    data: {
      organization_id: organizationId,
      interpreter_id: interpreterId,
      sender_type: isAdmin ? "admin" : "interpreter",
      sender_user_id: isAdmin ? senderId : null,
      body: body.body,
      // Clients echo the signed URL from the media upload — store the bare key.
      image_url: normalizeFileRef(body.image_url ?? null),
    },
    include: {
      sender_user: { select: { id: true, name: true } },
      interpreter: { select: { id: true, name: true } },
    },
  });
}

export async function markRead(
  interpreterId: string,
  requesterId: string,
  isAdmin: boolean,
  organizationId: string,
  prisma: PrismaClient,
) {
  if (!isAdmin && requesterId !== interpreterId) {
    throw new ForbiddenError("UNAUTHORIZED_CONVERSATION", "Cannot mark another interpreter's conversation as read");
  }
  const result = await prisma.message.updateMany({
    where: {
      organization_id: organizationId,
      interpreter_id: interpreterId,
      read_at: null,
      sender_type: isAdmin ? "interpreter" : "admin",
    },
    data: { read_at: new Date() },
  });
  return { marked_read: result.count };
}
