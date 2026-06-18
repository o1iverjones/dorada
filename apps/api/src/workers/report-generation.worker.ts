import { Worker, type Job } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";
import { stringify } from "csv-stringify/sync";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { config, redisConnection } from "../config.js";
import { uploadBuffer, reportPath, getSignedUrl } from "../integrations/r2.js";

function isR2Available(): boolean {
  return !!(config.R2_ACCOUNT_ID && config.R2_ACCESS_KEY_ID && config.R2_SECRET_ACCESS_ID);
}

const LOCAL_REPORTS_DIR = path.join(os.tmpdir(), "dorada-reports");

/** Save buffer to local disk and return the API-prefixed download path. */
function saveLocally(reportJobId: string, format: "pdf" | "csv", buffer: Buffer): string {
  fs.mkdirSync(LOCAL_REPORTS_DIR, { recursive: true });
  const filename = `${reportJobId}.${format}`;
  fs.writeFileSync(path.join(LOCAL_REPORTS_DIR, filename), buffer);
  return `/api/v1/reports/${reportJobId}/download`;
}

interface ReportJobData {
  reportJobId: string;
  organizationId: string;
  type: "interpreter_compensation" | "agency_billing" | "appointment_history" | "interpreter_performance";
  format: "pdf" | "csv";
  filters: Record<string, unknown>;
  locale: string;
  requestedBy: string;
  options?: Record<string, unknown>;
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
          buffer = await generatePdf(rows, type, filters, locale);
        }

        let downloadUrl: string;
        let gcsPath: string | undefined;

        if (isR2Available()) {
          gcsPath = reportPath(reportJobId, format);
          await uploadBuffer(gcsPath, buffer, format === "csv" ? "text/csv" : "application/pdf");
          downloadUrl = await getSignedUrl(gcsPath, 86400);
        } else {
          // Dev fallback: save to local temp dir, served via /reports/:id/download
          downloadUrl = saveLocally(reportJobId, format, buffer);
        }

        await prisma.reportJob.update({
          where: { id: reportJobId },
          data: {
            status: "completed",
            ...(gcsPath ? { gcs_path: gcsPath } : {}),
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
      connection: redisConnection,
      concurrency: 3,
    },
  );
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchReportData(
  type: string,
  organizationId: string,
  filters: Record<string, unknown>,
  prisma: PrismaClient,
): Promise<Record<string, unknown>[]> {
  const dateFrom = filters["date_from"] ? new Date(filters["date_from"] as string) : undefined;
  const dateTo = filters["date_to"] ? new Date(`${filters["date_to"] as string}T23:59:59Z`) : undefined;
  const dateFilter = dateFrom || dateTo
    ? { date_time: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
    : {};

  if (type === "interpreter_compensation") {
    const interpreterIds = filters["interpreter_ids"] as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        status: "completed",
        ...dateFilter,
        ...(interpreterIds?.length ? { interpreter_id: { in: interpreterIds } } : {}),
      },
      include: { interpreter: true, clinic: true, type: true },
      orderBy: [{ interpreter: { name: "asc" } }, { date_time: "asc" }],
    });
    return appointments.map((a) => ({
      date: a.date_time.toISOString().slice(0, 10),
      interpreter: a.interpreter?.name ?? "—",
      clinic: a.clinic.name,
      appointment_type: a.type.name,
      clocked_minutes: a.actual_duration_minutes ?? 0,
      billable_minutes: a.billable_duration_minutes ?? 0,
      rate_per_hour: Number(a.pay_rate ?? 0),
      amount: Number((((a.billable_duration_minutes ?? 0) / 60) * Number(a.pay_rate ?? 0)).toFixed(2)),
    }));
  }

  if (type === "agency_billing") {
    const agencyIds = filters["agency_ids"] as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        status: "completed",
        ...dateFilter,
        ...(agencyIds?.length ? { agency_id: { in: agencyIds } } : {}),
      },
      include: { patient: true, clinic: true, interpreter: true, agency: true },
      orderBy: [{ agency: { name: "asc" } }, { date_time: "asc" }],
    });
    return appointments.map((a) => ({
      date: a.date_time.toISOString().slice(0, 10),
      agency: a.agency?.name ?? "—",
      patient: a.patient.name,
      clinic: a.clinic.name,
      interpreter: a.interpreter?.name ?? "—",
      pre_auth_amount: a.pre_auth_amount ?? 0,
      pre_auth_mileage: a.pre_auth_mileage ?? 0,
      actual_amount: Number((((a.billable_duration_minutes ?? 0) / 60) * Number(a.pay_rate ?? 0)).toFixed(2)),
    }));
  }

  if (type === "appointment_history") {
    const statuses = filters["statuses"] as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        ...dateFilter,
        ...(statuses?.length ? { status: { in: statuses } } : {}),
      },
      include: { patient: true, clinic: true, interpreter: true, type: true },
      orderBy: { date_time: "asc" },
    });
    return appointments.map((a) => ({
      date: a.date_time.toISOString().slice(0, 10),
      patient: a.patient.name,
      clinic: a.clinic.name,
      interpreter: a.interpreter?.name ?? "—",
      language: a.language,
      appointment_type: a.type.name,
      status: a.status,
      duration_minutes: a.actual_duration_minutes ?? a.duration_minutes,
    }));
  }

  if (type === "interpreter_performance") {
    const interpreterIds = filters["interpreter_ids"] as string[] | undefined;
    const appointments = await prisma.appointment.findMany({
      where: {
        organization_id: organizationId,
        ...dateFilter,
        ...(interpreterIds?.length ? { interpreter_id: { in: interpreterIds } } : {}),
      },
      include: { interpreter: true },
      orderBy: [{ interpreter: { name: "asc" } }, { date_time: "asc" }],
    });
    return appointments.map((a) => ({
      interpreter: a.interpreter?.name ?? "—",
      date: a.date_time.toISOString().slice(0, 10),
      status: a.status,
      scheduled_time: a.date_time.toISOString().slice(11, 16),
      clock_in_time: a.clock_in_time ? a.clock_in_time.toISOString().slice(11, 16) : "—",
      hours_worked: ((a.actual_duration_minutes ?? 0) / 60).toFixed(2),
    }));
  }

  return [];
}

// ─── CSV generation ───────────────────────────────────────────────────────────

function generateCsv(rows: Record<string, unknown>[]): Buffer {
  if (rows.length === 0) return Buffer.from("No data\n");
  const headers = Object.keys(rows[0]!);
  const output = stringify(rows, { header: true, columns: headers });
  return Buffer.from(output, "utf-8");
}

// ─── PDF generation ───────────────────────────────────────────────────────────

const REPORT_TITLES: Record<string, string> = {
  interpreter_compensation: "Interpreter Compensation Report",
  agency_billing: "Insurance Agency Billing Report",
  appointment_history: "Appointment History Report",
  interpreter_performance: "Interpreter Performance Report",
};

// Column config per report type: [key, label, width, align]
type ColAlign = "left" | "right" | "center";
type ColDef = { key: string; label: string; width: number; align: ColAlign };

const COLUMNS: Record<string, ColDef[]> = {
  interpreter_compensation: [
    { key: "date",             label: "Date",         width: 68,  align: "left"  },
    { key: "interpreter",      label: "Interpreter",  width: 110, align: "left"  },
    { key: "clinic",           label: "Clinic",       width: 110, align: "left"  },
    { key: "appointment_type", label: "Type",         width: 60,  align: "left"  },
    { key: "clocked_minutes",  label: "Clocked",      width: 48,  align: "right" },
    { key: "billable_minutes", label: "Billable",     width: 48,  align: "right" },
    { key: "rate_per_hour",    label: "Rate/hr",      width: 50,  align: "right" },
    { key: "amount",           label: "Amount",       width: 56,  align: "right" },
  ],
  agency_billing: [
    { key: "date",             label: "Date",         width: 68,  align: "left"  },
    { key: "agency",           label: "Agency",       width: 100, align: "left"  },
    { key: "patient",          label: "Patient",      width: 100, align: "left"  },
    { key: "clinic",           label: "Clinic",       width: 90,  align: "left"  },
    { key: "interpreter",      label: "Interpreter",  width: 90,  align: "left"  },
    { key: "pre_auth_amount",  label: "Pre-Auth $",   width: 56,  align: "right" },
    { key: "actual_amount",    label: "Actual $",     width: 56,  align: "right" },
  ],
  appointment_history: [
    { key: "date",             label: "Date",         width: 68,  align: "left"  },
    { key: "patient",          label: "Patient",      width: 100, align: "left"  },
    { key: "clinic",           label: "Clinic",       width: 100, align: "left"  },
    { key: "interpreter",      label: "Interpreter",  width: 90,  align: "left"  },
    { key: "language",         label: "Language",     width: 60,  align: "left"  },
    { key: "status",           label: "Status",       width: 60,  align: "left"  },
    { key: "duration_minutes", label: "Min",          width: 36,  align: "right" },
  ],
  interpreter_performance: [
    { key: "date",             label: "Date",         width: 68,  align: "left"  },
    { key: "interpreter",      label: "Interpreter",  width: 110, align: "left"  },
    { key: "status",           label: "Status",       width: 70,  align: "left"  },
    { key: "scheduled_time",   label: "Scheduled",    width: 60,  align: "center"},
    { key: "clock_in_time",    label: "Clocked In",   width: 60,  align: "center"},
    { key: "hours_worked",     label: "Hours",        width: 44,  align: "right" },
  ],
};

// Colors
const COLOR_HEADER_BG = "#1e293b";   // slate-800
const COLOR_HEADER_FG = "#ffffff";
const COLOR_ROW_ALT   = "#f8fafc";   // slate-50
const COLOR_ROW_FG    = "#0f172a";   // slate-900
const COLOR_RULE      = "#e2e8f0";   // slate-200
const COLOR_TOTAL_BG  = "#f1f5f9";   // slate-100
const COLOR_ACCENT    = "#2563eb";   // blue-600

async function generatePdf(
  rows: Record<string, unknown>[],
  type: string,
  filters: Record<string, unknown>,
  _locale: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "LETTER", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const marginL = 36;
    const marginR = 36;
    const contentW = pageW - marginL - marginR;

    // ── Header bar ──────────────────────────────────────────────────────────
    doc.rect(0, 0, pageW, 52).fill(COLOR_HEADER_BG);
    doc.fillColor(COLOR_HEADER_FG).fontSize(16).font("Helvetica-Bold")
      .text(REPORT_TITLES[type] ?? `${type} Report`, marginL, 16, { width: contentW * 0.65 });

    const dateRange = [filters["date_from"], filters["date_to"]].filter(Boolean).join(" → ");
    if (dateRange) {
      doc.fontSize(9).font("Helvetica")
        .text(dateRange, marginL + contentW * 0.65, 22, { width: contentW * 0.35, align: "right" });
    }

    const generatedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    doc.fontSize(8).text(`Generated ${generatedAt}`, marginL, 38, { width: contentW, align: "right" });

    doc.fillColor(COLOR_ROW_FG);

    let y = 68;

    if (rows.length === 0) {
      doc.fontSize(11).font("Helvetica").text("No data for the selected period.", marginL, y);
      doc.end();
      return;
    }

    const cols = COLUMNS[type] ?? buildDynamicCols(rows[0]!, contentW);

    // Scale columns proportionally if total width ≠ contentW
    const totalDefined = cols.reduce((s, c) => s + c.width, 0);
    const scale = contentW / totalDefined;
    const scaledCols = cols.map((c) => ({ ...c, width: c.width * scale }));

    // ── Column header row ────────────────────────────────────────────────────
    const headerH = 18;
    doc.rect(marginL, y, contentW, headerH).fill(COLOR_ACCENT);
    doc.fillColor(COLOR_HEADER_FG).fontSize(7.5).font("Helvetica-Bold");
    let cx = marginL;
    for (const col of scaledCols) {
      doc.text(col.label, cx + 3, y + 5, { width: col.width - 6, align: col.align, lineBreak: false });
      cx += col.width;
    }
    y += headerH;

    // ── Data rows ────────────────────────────────────────────────────────────
    const rowH = 15;
    doc.fontSize(7.5).font("Helvetica");

    // Group rows by interpreter for R1 subtotals
    const isR1 = type === "interpreter_compensation";

    let grandTotal = 0;
    let groupTotal = 0;
    let groupKey = "";

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;

      // R1: detect interpreter group change → print subtotal
      if (isR1) {
        const rowKey = String(row["interpreter"] ?? "");
        if (i === 0) groupKey = rowKey;
        if (rowKey !== groupKey && i > 0) {
          // Subtotal row
          y = printSubtotalRow(doc, scaledCols, groupKey, groupTotal, marginL, contentW, y, rowH);
          groupTotal = 0;
          groupKey = rowKey;
          // Check page break
          if (y > doc.page.height - 60) { doc.addPage(); y = 36; }
        }
        groupTotal += Number(row["amount"] ?? 0);
        grandTotal += Number(row["amount"] ?? 0);
      }

      // Alternate row background
      if (i % 2 === 1) {
        doc.rect(marginL, y, contentW, rowH).fill(COLOR_ROW_ALT);
      }

      // Row rule
      doc.rect(marginL, y + rowH - 0.5, contentW, 0.5).fill(COLOR_RULE);

      doc.fillColor(COLOR_ROW_FG);
      cx = marginL;
      for (const col of scaledCols) {
        const val = row[col.key];
        const text = formatCell(col.key, val);
        doc.text(text, cx + 3, y + 4, { width: col.width - 6, align: col.align, lineBreak: false });
        cx += col.width;
      }
      y += rowH;

      // Page break
      if (y > doc.page.height - 60 && i < rows.length - 1) {
        doc.addPage();
        y = 36;
      }
    }

    // Final subtotal for R1 last group
    if (isR1 && rows.length > 0) {
      y = printSubtotalRow(doc, scaledCols, groupKey, groupTotal, marginL, contentW, y, rowH);
    }

    // ── Grand total (R1) ─────────────────────────────────────────────────────
    if (isR1) {
      y += 4;
      doc.rect(marginL, y, contentW, rowH + 2).fill(COLOR_TOTAL_BG);
      doc.fillColor(COLOR_ROW_FG).font("Helvetica-Bold").fontSize(8);
      doc.text("GRAND TOTAL", marginL + 3, y + 5, { width: contentW * 0.75, lineBreak: false });
      doc.text(`$${grandTotal.toFixed(2)}`, marginL + 3, y + 5, { width: contentW - 6, align: "right", lineBreak: false });
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 24;
    doc.fontSize(7).font("Helvetica").fillColor("#94a3b8")
      .text(`${rows.length} record${rows.length === 1 ? "" : "s"}  •  Dorada`, marginL, footerY, { width: contentW, align: "center" });

    doc.end();
  });
}

function printSubtotalRow(
  doc: InstanceType<typeof PDFDocument>,
  cols: { key: string; width: number; align: ColAlign }[],
  label: string,
  total: number,
  marginL: number,
  contentW: number,
  y: number,
  rowH: number,
): number {
  doc.rect(marginL, y, contentW, rowH).fill(COLOR_TOTAL_BG);
  doc.fillColor(COLOR_ROW_FG).font("Helvetica-Bold").fontSize(7.5);
  doc.text(`Subtotal — ${label}`, marginL + 3, y + 4, { width: contentW * 0.75, lineBreak: false });
  doc.text(`$${total.toFixed(2)}`, marginL + 3, y + 4, { width: contentW - 6, align: "right", lineBreak: false });
  doc.font("Helvetica");
  return y + rowH + 2;
}

function formatCell(key: string, val: unknown): string {
  if (val == null) return "—";
  if (key === "amount" || key === "actual_amount" || key === "pre_auth_amount" || key === "rate_per_hour") {
    return `$${Number(val).toFixed(2)}`;
  }
  return String(val);
}

function buildDynamicCols(sample: Record<string, unknown>, contentW: number): ColDef[] {
  const keys = Object.keys(sample);
  const w = contentW / keys.length;
  return keys.map((key) => ({ key, label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), width: w, align: "left" as ColAlign }));
}
