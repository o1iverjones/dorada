import { describe, it, expect } from "vitest";
import { requirePermission } from "./rbac.js";

function fakeReply() {
  return {
    statusCode: 0,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

function req(permissions?: string[]) {
  return { user: { sub: "u1", type: "admin", organization_id: "org-1", permissions } };
}

describe("requirePermission", () => {
  it("passes through when the permission is present", async () => {
    const reply = fakeReply();
    await requirePermission("manage_appointments")(req(["manage_appointments"]) as never, reply as never);
    expect(reply.statusCode).toBe(0); // untouched — handler will run
  });

  it("403s when the permission is missing", async () => {
    const reply = fakeReply();
    await requirePermission("manage_admin_users")(req(["manage_appointments"]) as never, reply as never);
    expect(reply.statusCode).toBe(403);
    expect(reply.payload).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("403s when the token carries no permissions at all (e.g. interpreter token)", async () => {
    const reply = fakeReply();
    await requirePermission("manage_appointments")(req(undefined) as never, reply as never);
    expect(reply.statusCode).toBe(403);
  });
});
