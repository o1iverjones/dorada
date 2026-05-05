import { Worker, type Job } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";
import { stringify } from "csv-stringify/sync";
import { config } from "../config.js";
import { uploadBuffer, reportPath } from "../integrations/gcs.js";
import { getSignedUrl } from "../integrations/gcs.js";

interface ReportJobData {
  reportJobId: string;
  organizationId: string;
  type: "r1" | "r2" | "r3" | "r4";
  format: "pdf" | "csv";
  filters: Record<string, unknown>;
  locale: string;
  requestedBy: string;
}

export function createReportGenerationWorker(prisma: PrismaClient) {
  return new Worker<ReportJobData>(
    "report-generation",
    async (job: Job<ReportJobData>) => {
      const { reportJobId, organizationId, type, format, filters, locale } = job.data;

      await prisma.reportJob.update({
        where: { id: reportJobId },
        data: { status: "processing" },
      });

      try {
        const rows = await fetchReportData(type, organizationId, filters, prisma);

        let buffer: Buffer;
        if (format === "csv") {
          buffer = generateCsv(rows);
        } else {
          buffer = await generatePdf(rows, type, locale);
        }

        const gcsPath = reportPath(reportJobId, format);
        await uploadBuffer(gcsPath, buffer, format === "csv" ? "text/csv" : "application/pdf");
        const downloadUrl = await getSignedUrl(gcsPath, 86400);

        await prisma.reportJob.update({
          where: { id: reportJobId },
          data: {
            status: "completed",
            gcs_path: gcsPath,
            download_url: downloadUrl,
            completed_at: new Date(),
          },
        });
      } catch (err) {
        await prisma.reportJob.update({
          where: { id: reportJobId },
          data: {
            status: "failed",
            error_message: err instanceof Error ? err.message : String(err),
          },
        });
        throw err;
      }
    },
    {
      connection: { host: config.REDIS_HOST, port: config.REDIS_PORT },
      concurrency: 3,
    },
  );
}

async function fetchReportData(
  type: string,
  organizationId: string,
  filters: Record<string, unknown>,
  prisma: PrismaClient,
): Promise<Record<string, unknown>[]> {
  const dateFrom = filters.date_from ? new Date(filters.date_from as string) : undefined;
  const dateTo = filters.date_to ? new Date(`${filters.date_to}T23:59:59Z`) : undefined;
  const dateFilter = dateFrom || dateTo ? { date_time: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {};

  if (type === "r1") {
    const interpreterIds = filters.interpreter_ids as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        status: "completed",
        ...dateFilter,
        ...(interpreterIds ? { interpreter_id: { in: interpreterIds } } : {}),
      },
      include: {
        interpreter: true,
        clinic: true,
        type: true,
      },
      orderBy: { date_time: "asc" },
    });
    return appointments.map((a) => ({
      date: a.date_time.toISOString(),
      interpreter: a.interpreter?.name ?? "",
      clinic: a.clinic.name,
      type: a.type.name,
      clocked_minutes: a.actual_duration_minutes ?? 0,
      billable_minutes: a.billable_duration_minutes ?? 0,
      rate: a.pay_rate ?? 0,
      amount: ((a.billable_duration_minutes ?? 0) / 60) * (a.pay_rate ?? 0),
    }));
  }

  if (type === "r2") {
    const agencyIds = filters.insurance_agency_ids as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        status: "completed",
        ...dateFilter,
        ...(agencyIds ? { insurance_agency_id: { in: agencyIds } } : {}),
      },
      include: { patient: true, clinic: true, interpreter: true, insurance_agency: true },
      orderBy: { date_time: "asc" },
    });
    return appointments.map((a) => ({
      date: a.date_time.toISOString(),
      patient: a.patient.name,
      clinic: a.clinic.name,
      interpreter: a.interpreter?.name ?? "",
      agency: a.insurance_agency?.name ?? "",
      pre_auth_amount: a.pre_auth_amount,
      pre_auth_mileage: a.pre_auth_mileage,
      actual_amount: ((a.billable_duration_minutes ?? 0) / 60) * (a.pay_rate ?? 0),
    }));
  }

  if (type === "r3") {
    const statuses = filters.statuses as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        ...dateFilter,
        ...(statuses ? { status: { in: statuses } } : {}),
      },
      include: { patient: true, clinic: true, interpreter: true, type: true },
      orderBy: { date_time: "asc" },
    });
    return appointments.map((a) => ({
      date: a.date_time.toISOString(),
      patient: a.patient.name,
      clinic: a.clinic.name,
      interpreter: a.interpreter?.name ?? "",
      language: a.language,
      type: a.type.name,
      status: a.status,
      duration_minutes: a.actual_duration_minutes ?? a.duration_minutes,
    }));
  }

  if (type === "r4") {
    const interpreterIds = filters.interpreter_ids as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        ...dateFilter,
        ...(interpreterIds ? { interpreter_id: { in: interpreterIds } } : {}),
      },
      include: { interpreter: true },
      orderBy: { date_time: "asc" },
    });
    return appointments.map((a) => ({
      interpreter: a.interpreter?.name ?? "",
      date: a.date_time.toISOString(),
      status: a.status,
      clock_in: a.clock_in_time?.toISOString() ?? null,
      scheduled_time: a.date_time.toISOString(),
      hours_worked: ((a.actual_duration_minutes ?? 0) / 60).toFixed(2),
    }));
  }

  return [];
}

function generateCsv(rows: Record<string, unknown>[]): Buffer {
  if (rows.length === 0) return Buffer.from("No data\n");
  const headers = Object.keys(rows[0]!);
  const output = stringify(rows, { header: true, columns: headers });
  return Buffer.from(output, "utf-8");
}

async function generatePdf(
  rows: Record<string, unknown>[],
  type: string,
  _locale: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(`Report ${type.toUpperCase()}`, { align: "center" });
    doc.moveDown();

    if (rows.length === 0) {
      doc.fontSize(10).text("No data for selected period.");
    } else {
      const headers = Object.keys(rows[0]!);
      doc.fontSize(8);

      doc.font("Helvetica-Bold").text(headers.join("  |  "), { lineGap: 4 });
      doc.font("Helvetica");
      for (const row of rows) {
        const line = headers.map((h) => String(row[h] ?? "")).join("  |  ");
        doc.text(line, { lineGap: 2 });
      }
    }

    doc.end();
  });
}
