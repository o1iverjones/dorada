import { describe, it, expect, vi } from "vitest";
import { listMessages, sendMessage, markRead } from "./messages.service.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";

function fakePrisma(interpreter: Record<string, unknown> | null) {
  return {
    interpreter: { findFirst: vi.fn(async () => interpreter) },
    message: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        ...args.data,
        id: "msg-1",
        sent_at: new Date(),
        read_at: null,
        sender_user: null,
        interpreter: { id: interpreter?.id, name: interpreter?.name },
      })),
    },
  };
}

const query = { limit: 50 };

describe("conversation ownership", () => {
  it("blocks an interpreter from reading another interpreter's conversation", async () => {
    const prisma = fakePrisma({ id: "int-2", name: "Other", organization_id: "org-1" });
    await expect(
      listMessages("int-2", "int-1", false, "org-1", query, prisma as never),
    ).rejects.toThrow(ForbiddenError);
    // must be rejected before any DB access
    expect(prisma.interpreter.findFirst).not.toHaveBeenCalled();
  });

  it("allows an interpreter to read their own conversation", async () => {
    const prisma = fakePrisma({ id: "int-1", name: "Me", organization_id: "org-1" });
    const res = await listMessages("int-1", "int-1", false, "org-1", query, prisma as never);
    expect(res.data).toEqual([]);
  });

  it("allows an admin to read any conversation in their org", async () => {
    const prisma = fakePrisma({ id: "int-2", name: "Other", organization_id: "org-1" });
    const res = await listMessages("int-2", "admin-1", true, "org-1", query, prisma as never);
    expect(res.data).toEqual([]);
  });

  it("404s when the interpreter belongs to another org", async () => {
    const prisma = fakePrisma(null); // findFirst is org-scoped → no match
    await expect(
      listMessages("int-9", "admin-1", true, "org-1", query, prisma as never),
    ).rejects.toThrow(NotFoundError);
  });

  it("blocks an interpreter from sending into another interpreter's thread", async () => {
    const prisma = fakePrisma({ id: "int-2", name: "Other", organization_id: "org-1" });
    await expect(
      sendMessage("int-2", "int-1", false, "org-1", { body: "hi" }, prisma as never),
    ).rejects.toThrow(ForbiddenError);
  });

  it("blocks an interpreter from marking another interpreter's thread as read", async () => {
    const prisma = fakePrisma({ id: "int-2", name: "Other", organization_id: "org-1" });
    await expect(markRead("int-2", "int-1", false, "org-1", prisma as never)).rejects.toThrow(
      ForbiddenError,
    );
    expect(prisma.message.updateMany).not.toHaveBeenCalled();
  });

  it("allows admins and thread owners to mark read", async () => {
    const prisma = fakePrisma({ id: "int-1", name: "Me", organization_id: "org-1" });
    await expect(markRead("int-1", "int-1", false, "org-1", prisma as never)).resolves.toEqual({ marked_read: 0 });
    await expect(markRead("int-1", "admin-1", true, "org-1", prisma as never)).resolves.toEqual({ marked_read: 0 });
  });

  it("records admin sender id on admin messages", async () => {
    const prisma = fakePrisma({ id: "int-1", name: "Me", organization_id: "org-1" });
    await sendMessage("int-1", "admin-1", true, "org-1", { body: "hello" }, prisma as never);
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sender_type: "admin", sender_user_id: "admin-1" }),
      }),
    );
  });
});
