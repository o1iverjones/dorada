import { describe, it, expect, vi } from "vitest";
import {
  assertValidTransition,
  ADMIN_RESOLVABLE_STATUSES,
  unassignInterpreter,
} from "./appointments.service.js";
import { ValidationError, ConflictError, NotFoundError } from "../../lib/errors.js";

describe("assertValidTransition", () => {
  it("allows the happy-path lifecycle", () => {
    expect(() => assertValidTransition("unassigned", "pending_offer")).not.toThrow();
    expect(() => assertValidTransition("pending_offer", "accepted")).not.toThrow();
    expect(() => assertValidTransition("accepted", "in_progress")).not.toThrow();
    expect(() => assertValidTransition("in_progress", "completed")).not.toThrow();
  });

  it("allows same-status no-op transitions", () => {
    expect(() => assertValidTransition("completed", "completed")).not.toThrow();
    expect(() => assertValidTransition("cancelled", "cancelled")).not.toThrow();
  });

  it("blocks skipping lifecycle steps", () => {
    expect(() => assertValidTransition("unassigned", "completed")).toThrow(ValidationError);
    expect(() => assertValidTransition("pending_offer", "in_progress")).toThrow(ValidationError);
    expect(() => assertValidTransition("completed", "in_progress")).toThrow(ValidationError);
  });

  it("allows every status to be resolved to an admin-resolvable status", () => {
    for (const from of ["unassigned", "pending_offer", "accepted", "in_progress", "completed"]) {
      for (const to of ADMIN_RESOLVABLE_STATUSES) {
        expect(() => assertValidTransition(from, to)).not.toThrow();
      }
    }
  });

  it("allows re-classification between admin-resolvable statuses", () => {
    expect(() => assertValidTransition("cancelled", "no_show")).not.toThrow();
    expect(() => assertValidTransition("no_show", "late_cancellation")).not.toThrow();
  });
});

// Minimal in-memory prisma stub for the unassign flow.
function fakePrisma(appt: Record<string, unknown> | null) {
  const appointmentUpdates: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  return {
    appointmentUpdates,
    appointment: {
      findUnique: vi.fn(async () => appt),
      update: vi.fn(async (args: { where: unknown; data: Record<string, unknown> }) => {
        appointmentUpdates.push(args);
        return { ...appt, ...args.data };
      }),
    },
    appointmentOffer: { updateMany: vi.fn(async () => ({ count: 0 })) },
    appointmentActivity: { create: vi.fn(async () => ({})) },
    activityLog: { create: vi.fn(async () => ({})) },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };
}

function appt(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "appt-1",
    organization_id: "org-1",
    status,
    interpreter_id: "int-1",
    patient: { name: "Test Patient" },
    po_number: null,
    ...overrides,
  };
}

const actor = { id: "admin-1", name: "Admin" };

describe("unassignInterpreter status preservation", () => {
  it.each(["completed", ...ADMIN_RESOLVABLE_STATUSES])(
    "preserves terminal status %s",
    async (status) => {
      const prisma = fakePrisma(appt(status));
      await unassignInterpreter("appt-1", "org-1", actor, prisma as never);
      expect(prisma.appointmentUpdates[0]!.data).toMatchObject({
        interpreter_id: null,
        status, // must NOT be clobbered to "unassigned"
      });
    },
  );

  it.each(["accepted", "pending_offer", "in_progress"])(
    "reverts non-terminal status %s to unassigned",
    async (status) => {
      const prisma = fakePrisma(appt(status));
      await unassignInterpreter("appt-1", "org-1", actor, prisma as never);
      expect(prisma.appointmentUpdates[0]!.data).toMatchObject({
        interpreter_id: null,
        status: "unassigned",
      });
    },
  );

  it("rejects when no interpreter is assigned", async () => {
    const prisma = fakePrisma(appt("accepted", { interpreter_id: null }));
    await expect(unassignInterpreter("appt-1", "org-1", actor, prisma as never)).rejects.toThrow(
      ConflictError,
    );
  });

  it("rejects cross-tenant access as not-found", async () => {
    const prisma = fakePrisma(appt("accepted"));
    await expect(
      unassignInterpreter("appt-1", "other-org", actor, prisma as never),
    ).rejects.toThrow(NotFoundError);
  });

  it("expires outstanding offers as part of the unassign", async () => {
    const prisma = fakePrisma(appt("accepted"));
    await unassignInterpreter("appt-1", "org-1", actor, prisma as never);
    expect(prisma.appointmentOffer.updateMany).toHaveBeenCalledWith({
      where: { appointment_id: "appt-1" },
      data: { status: "expired" },
    });
  });
});
