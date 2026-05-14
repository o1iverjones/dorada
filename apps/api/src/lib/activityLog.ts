import type { PrismaClient } from "@prisma/client";

export async function writeActivityLog(
  prisma: PrismaClient,
  {
    organizationId,
    entityType,
    entityId,
    entityName,
    action,
    detail,
    poNumber,
    adminId,
    adminName,
  }: {
    organizationId: string;
    entityType: "appointment" | "clinic" | "interpreter" | "agency" | "admin_user" | "report";
    entityId: string;
    entityName?: string | null | undefined;
    action: string;
    detail?: string | null | undefined;
    poNumber?: string | null | undefined;
    adminId?: string | null | undefined;
    adminName: string;
  },
) {
  await prisma.activityLog.create({
    data: {
      organization_id: organizationId,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName ?? null,
      action,
      detail: detail ?? null,
      po_number: poNumber ?? null,
      admin_id: adminId ?? null,
      admin_name: adminName,
    },
  });
}
