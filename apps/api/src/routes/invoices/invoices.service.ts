import type { PrismaClient } from "@prisma/client";
import type { InvoiceListQuery, ApproveInvoiceBody } from "@dorada/types";
import { NotFoundError, ForbiddenError } from "../../lib/errors.js";

const INVOICE_INCLUDE = {
  appointment: {
    select: {
      id: true,
      date_time: true,
      duration_minutes: true,
      po_number: true,
      clock_in_time: true,
      clock_in_distance_miles: true,
      clock_out_time: true,
      patient: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
    },
  },
  interpreter: { select: { id: true, name: true } },
  approved_by: { select: { id: true, name: true } },
};

export async function listInvoices(
  query: InvoiceListQuery,
  organizationId: string,
  prisma: PrismaClient,
) {
  const where = {
    organization_id: organizationId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.interpreter_id ? { interpreter_id: query.interpreter_id } : {}),
    ...(query.cursor ? { id: { gt: query.cursor } } : {}),
  };

  const invoices = await prisma.invoice.findMany({
    where,
    include: INVOICE_INCLUDE,
    orderBy: { submitted_at: "desc" },
    take: query.limit + 1,
  });

  const hasMore = invoices.length > query.limit;
  const data = hasMore ? invoices.slice(0, query.limit) : invoices;
  return {
    data: data.map(serializeInvoice),
    pagination: { has_more: hasMore, next_cursor: hasMore ? (data.at(-1)?.id ?? null) : null },
  };
}

export async function getInvoice(id: string, organizationId: string, prisma: PrismaClient) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
  if (!invoice || invoice.organization_id !== organizationId) throw new NotFoundError("INVOICE_NOT_FOUND", "Invoice not found");
  return serializeInvoice(invoice);
}

export async function approveInvoice(
  id: string,
  organizationId: string,
  approverId: string,
  body: ApproveInvoiceBody,
  prisma: PrismaClient,
) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice || invoice.organization_id !== organizationId) throw new NotFoundError("INVOICE_NOT_FOUND", "Invoice not found");
  if (invoice.status !== "submitted") throw new ForbiddenError("ALREADY_APPROVED", "Invoice is already approved");

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: "approved",
      approved_at: new Date(),
      approved_by_id: approverId,
      ...(body.notes ? { notes: body.notes } : {}),
    },
    include: INVOICE_INCLUDE,
  });
  return serializeInvoice(updated);
}

export async function getInvoiceStats(organizationId: string, prisma: PrismaClient) {
  const submitted = await prisma.invoice.count({ where: { organization_id: organizationId, status: "submitted" } });
  return { submitted_count: submitted };
}

export async function getInterpreterInvoices(
  interpreterId: string,
  prisma: PrismaClient,
  dateFrom?: string,
  dateTo?: string,
) {
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (dateFrom) dateFilter.gte = new Date(dateFrom);
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    dateFilter.lte = to;
  }

  const where = {
    interpreter_id: interpreterId,
    ...(Object.keys(dateFilter).length ? { submitted_at: dateFilter } : {}),
  };

  const invoices = await prisma.invoice.findMany({
    where,
    include: INVOICE_INCLUDE,
    orderBy: { submitted_at: "desc" },
    take: 500,
  });

  const totalEarnings = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const approvedCount = invoices.filter((inv) => inv.status === "approved").length;
  const submittedCount = invoices.filter((inv) => inv.status === "submitted").length;

  const periodLabel = buildPeriodLabel(dateFrom, dateTo);

  return {
    summary: {
      total_earnings: totalEarnings,
      approved_count: approvedCount,
      submitted_count: submittedCount,
      period_label: periodLabel,
    },
    data: invoices.map(serializeInvoice),
  };
}

function buildPeriodLabel(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom && !dateTo) return "All Time";
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
  if (dateFrom) return `From ${fmt(dateFrom)}`;
  return `Until ${fmt(dateTo!)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeInvoice(inv: any) {
  return {
    ...inv,
    amount: Number(inv.amount),
    pay_rate: Number(inv.pay_rate),
  };
}
