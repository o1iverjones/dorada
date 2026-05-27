import { parse } from "csv-parse/sync";
import type { PrismaClient } from "@prisma/client";

export type EntityType = "interpreters" | "clinics" | "patients" | "insurance-agencies" | "appointments";

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: ImportRowError[];
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: Record<EntityType, { headers: string[]; example: string[] }> = {
  appointments: {
    headers: [
      "date_time", "duration_minutes", "appointment_type", "language",
      "interpreter_type_required", "patient_name", "patient_mrn",
      "clinic_name", "insurance_agency_name", "referring_physician",
      "pre_auth_amount", "pre_auth_mileage", "po_number", "interpreter_phone",
    ],
    example: [
      "2026-06-15 10:00", "60", "In-Person", "es",
      "Certified", "John Smith", "MRN-00123",
      "Riverside Medical Center", "BlueCross Demo", "Dr. Emily Carter",
      "150.00", "20", "PO-2026-001", "+15550001001",
    ],
  },
  interpreters: {
    headers: [
      "name", "phone", "email", "type", "languages",
      "address", "pay_rate", "payment_method",
      "emergency_contact_name", "emergency_contact_phone", "notes",
    ],
    example: [
      "Maria Garcia", "+15550001001", "maria@example.com", "Certified", "es,zh",
      "123 Main St", "45.00", "check",
      "Juan Garcia", "+15550009999", "",
    ],
  },
  clinics: {
    headers: [
      "name", "address", "phone",
      "primary_contact_name", "primary_contact_phone", "primary_contact_email",
      "billing_model", "billing_hourly_rate", "billing_flat_rate", "billing_invoice_cycle",
    ],
    example: [
      "Riverside Medical", "123 Main St", "555-100-0001",
      "Jane Doe", "555-100-0002", "jane@clinic.com",
      "hourly", "120.00", "", "monthly",
    ],
  },
  patients: {
    headers: ["name", "mrn", "phone", "email", "preferred_language"],
    example: ["John Smith", "MRN-00123", "555-200-0001", "john@example.com", "es"],
  },
  "insurance-agencies": {
    headers: [
      "name", "address", "phone",
      "primary_contact_name", "primary_contact_phone", "primary_contact_email", "notes",
    ],
    example: [
      "BlueCross Insurance", "456 Oak Ave", "555-300-0001",
      "Alice Brown", "555-300-0002", "alice@bluecross.com", "",
    ],
  },
};

export function getTemplateCsv(entity: EntityType): string {
  const t = TEMPLATES[entity];
  return [t.headers.join(","), t.example.join(",")].join("\n");
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseRows(csvText: string): Record<string, string>[] {
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

// ─── Staff-list format helpers ────────────────────────────────────────────────

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Already has country code
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function extractTypeFromTags(row: Record<string, string>): "certified" | "qualified" {
  for (let t = 1; t <= 27; t++) {
    const val = row[`Tag ${t}`]?.trim().toLowerCase();
    if (val === "certified") return "certified";
    if (val === "qualified") return "qualified";
  }
  return "qualified";
}

function extractPayRate(row: Record<string, string>, type: "certified" | "qualified"): number | null {
  const preferredPositions =
    type === "certified"
      ? ["interpreter - certified", "new rate", "interpreter normal"]
      : ["interpreter normal", "interpreter - certified"];

  for (let p = 1; p <= 12; p++) {
    const pos = row[`Position ${p}`]?.trim().toLowerCase();
    const rate = row[`Rate ${p}`]?.replace(/[^0-9.]/g, "");
    if (pos && rate && preferredPositions.includes(pos)) {
      const parsed = parseFloat(rate);
      if (!isNaN(parsed)) return parsed;
    }
  }
  // Fall back to first available rate
  for (let p = 1; p <= 12; p++) {
    const rate = row[`Rate ${p}`]?.replace(/[^0-9.]/g, "");
    if (rate) {
      const parsed = parseFloat(rate);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return null;
}

function buildAddress(row: Record<string, string>): string | null {
  const parts = [
    row["Address 1"]?.trim(),
    row["Address 2"]?.trim(),
    row["City"]?.trim(),
    row["State"]?.trim(),
    row["Zip"]?.trim(),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function isStaffListFormat(row: Record<string, string>): boolean {
  return "Last Name" in row && "First Name" in row;
}

// ─── Import handlers ──────────────────────────────────────────────────────────

export async function importInterpreters(
  csvText: string,
  organizationId: string,
  prisma: PrismaClient,
): Promise<ImportResult> {
  const rows = parseRows(csvText);
  const result: ImportResult = { total: rows.length, created: 0, updated: 0, errors: [] };

  const staffListMode = rows.length > 0 && isStaffListFormat(rows[0]!);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;

    let name: string, phone: string | null, type: "certified" | "qualified",
      email: string | null, address: string | null, payRate: number | null,
      paymentMethod: string | null, emergencyContactName: string | null,
      emergencyContactPhone: string | null, notes: string | null,
      languages: string[];

    if (staffListMode) {
      const firstName = row["First Name"]?.trim();
      const lastName = row["Last Name"]?.trim();
      name = [firstName, lastName].filter(Boolean).join(" ");
      phone = normalizePhone(row["Phone Number"] ?? "");
      email = row["Email"]?.trim() || null;
      type = extractTypeFromTags(row);
      address = buildAddress(row);
      payRate = extractPayRate(row, type);
      paymentMethod = row["Tax Status"]?.trim() || null;
      emergencyContactName = row["Emergency Contact Name"]?.trim() || null;
      emergencyContactPhone = normalizePhone(row["Emergency Contact Phone Number"] ?? "") ;
      notes = row["Notes"]?.trim() || null;
      languages = ["es"]; // Spanish interpreting agency default
    } else {
      name = row["name"]?.trim() ?? "";
      phone = row["phone"]?.trim() || null;
      const rawType = row["type"]?.trim().toLowerCase();
      if (!rawType || !["certified", "qualified"].includes(rawType)) {
        result.errors.push({ row: rowNum, message: "type must be 'certified' or 'qualified'" });
        continue;
      }
      type = rawType as "certified" | "qualified";
      email = row["email"]?.trim() || null;
      address = row["address"]?.trim() || null;
      payRate = row["pay_rate"] ? parseFloat(row["pay_rate"]) : null;
      paymentMethod = row["payment_method"]?.trim() || null;
      emergencyContactName = row["emergency_contact_name"]?.trim() || null;
      emergencyContactPhone = row["emergency_contact_phone"]?.trim() || null;
      notes = row["notes"]?.trim() || null;
      languages = row["languages"]
        ? row["languages"].split(",").map((l) => l.trim()).filter(Boolean)
        : [];
    }

    if (!name) { result.errors.push({ row: rowNum, message: "name is required" }); continue; }
    if (!phone) { result.errors.push({ row: rowNum, message: "phone is required — row skipped" }); continue; }

    const data = {
      organization_id: organizationId,
      name,
      phone,
      email,
      type,
      languages,
      address,
      pay_rate: payRate,
      payment_method: paymentMethod,
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      notes,
    };

    try {
      const existing = await prisma.interpreter.findFirst({
        where: { organization_id: organizationId, phone },
      });
      if (existing) {
        await prisma.interpreter.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        await prisma.interpreter.create({ data });
        result.created++;
      }
    } catch (err) {
      result.errors.push({ row: rowNum, message: (err as Error).message });
    }
  }

  return result;
}

export async function importClinics(
  csvText: string,
  organizationId: string,
  prisma: PrismaClient,
): Promise<ImportResult> {
  const rows = parseRows(csvText);
  const result: ImportResult = { total: rows.length, created: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;

    const name = row["name"]?.trim();

    if (!name) { result.errors.push({ row: rowNum, message: "name is required" }); continue; }

    const data = {
      organization_id: organizationId,
      name,
      address: row["address"] || null,
      phone: row["phone"] || null,
      primary_contact_name: row["primary_contact_name"] || null,
      primary_contact_phone: row["primary_contact_phone"] || null,
      primary_contact_email: row["primary_contact_email"] || null,
      billing_model: row["billing_model"]?.trim() || "hourly",
      billing_hourly_rate: row["billing_hourly_rate"] ? parseFloat(row["billing_hourly_rate"]) : null,
      billing_flat_rate: row["billing_flat_rate"] ? parseFloat(row["billing_flat_rate"]) : null,
      billing_invoice_cycle: row["billing_invoice_cycle"] || "monthly",
    };

    try {
      const existing = await prisma.clinic.findFirst({
        where: { organization_id: organizationId, name },
      });
      if (existing) {
        await prisma.clinic.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        await prisma.clinic.create({ data });
        result.created++;
      }
    } catch (err) {
      result.errors.push({ row: rowNum, message: (err as Error).message });
    }
  }

  return result;
}

export async function importPatients(
  csvText: string,
  organizationId: string,
  prisma: PrismaClient,
): Promise<ImportResult> {
  const rows = parseRows(csvText);
  const result: ImportResult = { total: rows.length, created: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;

    const name = row["name"]?.trim();
    if (!name) { result.errors.push({ row: rowNum, message: "name is required" }); continue; }

    const mrn = row["mrn"]?.trim() || null;

    const data = {
      organization_id: organizationId,
      name,
      mrn,
      phone: row["phone"] || null,
      email: row["email"] || null,
      preferred_language: row["preferred_language"] || null,
    };

    try {
      const existing = mrn
        ? await prisma.patient.findFirst({ where: { organization_id: organizationId, mrn } })
        : null;

      if (existing) {
        await prisma.patient.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        await prisma.patient.create({ data });
        result.created++;
      }
    } catch (err) {
      result.errors.push({ row: rowNum, message: (err as Error).message });
    }
  }

  return result;
}

function isAgencyListFormat(row: Record<string, string>): boolean {
  return "Name" in row && "Company Id" in row;
}

export async function importInsuranceAgencies(
  csvText: string,
  organizationId: string,
  prisma: PrismaClient,
): Promise<ImportResult> {
  const rows = parseRows(csvText);
  const result: ImportResult = { total: 0, created: 0, updated: 0, errors: [] };

  const agencyListMode = rows.length > 0 && isAgencyListFormat(rows[0]!);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;

    let name: string, phone: string | null, contactName: string | null,
      contactPhone: string | null, contactEmail: string | null, notes: string | null;

    if (agencyListMode) {
      // Skip archived records
      if (row["Archived At"]?.trim()) continue;

      name = row["Name"]?.trim() ?? "";
      phone = null; // no agency-level phone in this format
      contactName = row["Contact Full Name"]?.trim() || null;
      contactPhone = normalizePhone(row["Contact Phone Number"] ?? "") ;
      contactEmail = row["Contact Email"]?.trim() || null;
      // Combine admin + supervisor notes, skipping blanks
      const noteParts = [row["Admin Notes"]?.trim(), row["Supervisor Notes"]?.trim()].filter(Boolean);
      notes = noteParts.length ? noteParts.join("\n\n") : null;
    } else {
      name = row["name"]?.trim() ?? "";
      phone = row["phone"] || null;
      contactName = row["primary_contact_name"] || null;
      contactPhone = row["primary_contact_phone"] || null;
      contactEmail = row["primary_contact_email"] || null;
      notes = row["notes"] || null;
    }

    if (!name) { result.errors.push({ row: rowNum, message: "name is required" }); continue; }
    result.total++;

    const data = {
      organization_id: organizationId,
      name,
      address: null,
      phone,
      primary_contact_name: contactName,
      primary_contact_phone: contactPhone,
      primary_contact_email: contactEmail,
      notes,
    };

    try {
      const existing = await prisma.insuranceAgency.findFirst({
        where: { organization_id: organizationId, name },
      });
      if (existing) {
        await prisma.insuranceAgency.update({ where: { id: existing.id }, data });
        result.updated++;
      } else {
        await prisma.insuranceAgency.create({ data });
        result.created++;
      }
    } catch (err) {
      result.errors.push({ row: rowNum, message: (err as Error).message });
    }
  }

  return result;
}

export async function importAppointments(
  csvText: string,
  organizationId: string,
  prisma: PrismaClient,
): Promise<ImportResult> {
  const rows = parseRows(csvText);
  const result: ImportResult = { total: rows.length, created: 0, updated: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2;

    const dateTimeStr = row["date_time"]?.trim();
    const durationStr = row["duration_minutes"]?.trim();
    const appointmentTypeName = row["appointment_type"]?.trim();
    const language = row["language"]?.trim();
    const interpreterTypeRequired = row["interpreter_type_required"]?.trim().toLowerCase();
    const patientName = row["patient_name"]?.trim();
    const clinicName = row["clinic_name"]?.trim();
    const insuranceAgencyName = row["insurance_agency_name"]?.trim();
    const preAuthAmountStr = row["pre_auth_amount"]?.trim();

    if (!dateTimeStr) { result.errors.push({ row: rowNum, message: "date_time is required" }); continue; }
    if (!durationStr) { result.errors.push({ row: rowNum, message: "duration_minutes is required" }); continue; }
    if (!appointmentTypeName) { result.errors.push({ row: rowNum, message: "appointment_type is required" }); continue; }
    if (!language) { result.errors.push({ row: rowNum, message: "language is required" }); continue; }
    if (!interpreterTypeRequired) { result.errors.push({ row: rowNum, message: "interpreter_type_required is required" }); continue; }
    if (!patientName) { result.errors.push({ row: rowNum, message: "patient_name is required" }); continue; }
    if (!clinicName) { result.errors.push({ row: rowNum, message: "clinic_name is required" }); continue; }
    if (!insuranceAgencyName) { result.errors.push({ row: rowNum, message: "insurance_agency_name is required" }); continue; }

    const dateTime = new Date(dateTimeStr);
    if (isNaN(dateTime.getTime())) {
      result.errors.push({ row: rowNum, message: `date_time '${dateTimeStr}' is not a valid date (use YYYY-MM-DD HH:MM)` });
      continue;
    }

    const durationMinutes = parseInt(durationStr, 10);
    if (isNaN(durationMinutes)) {
      result.errors.push({ row: rowNum, message: "duration_minutes must be a number" });
      continue;
    }

    try {
      const appointmentType = await prisma.appointmentType.findFirst({
        where: { organization_id: organizationId, name: appointmentTypeName, is_active: true },
      });
      if (!appointmentType) {
        result.errors.push({ row: rowNum, message: `appointment_type '${appointmentTypeName}' not found` });
        continue;
      }

      const clinic = await prisma.clinic.findFirst({
        where: { organization_id: organizationId, name: clinicName, is_active: true },
      });
      if (!clinic) {
        result.errors.push({ row: rowNum, message: `clinic '${clinicName}' not found — import clinics first` });
        continue;
      }

      const insuranceAgency = await prisma.insuranceAgency.findFirst({
        where: { organization_id: organizationId, name: insuranceAgencyName, is_active: true },
      });
      if (!insuranceAgency) {
        result.errors.push({ row: rowNum, message: `insurance_agency '${insuranceAgencyName}' not found — import agencies first` });
        continue;
      }

      const patientMrn = row["patient_mrn"]?.trim() || null;
      let patient = patientMrn
        ? await prisma.patient.findFirst({ where: { organization_id: organizationId, mrn: patientMrn } })
        : await prisma.patient.findFirst({ where: { organization_id: organizationId, name: patientName } });

      if (!patient) {
        patient = await prisma.patient.create({
          data: { organization_id: organizationId, name: patientName, mrn: patientMrn },
        });
      }

      let interpreterId: string | null = null;
      const interpreterPhone = row["interpreter_phone"]?.trim();
      if (interpreterPhone) {
        const interpreter = await prisma.interpreter.findFirst({
          where: { organization_id: organizationId, phone: interpreterPhone },
        });
        if (interpreter) interpreterId = interpreter.id;
      }

      const poNumber = row["po_number"]?.trim() || null;
      if (poNumber) {
        const existing = await prisma.appointment.findFirst({
          where: { organization_id: organizationId, po_number: poNumber },
        });
        if (existing) {
          result.errors.push({ row: rowNum, message: `duplicate po_number '${poNumber}' — skipped` });
          continue;
        }
      }

      await prisma.appointment.create({
        data: {
          organization_id: organizationId,
          date_time: dateTime,
          duration_minutes: durationMinutes,
          type_id: appointmentType.id,
          language,
          interpreter_type_required: interpreterTypeRequired,
          interpreter_id: interpreterId,
          clinic_id: clinic.id,
          insurance_agency_id: insuranceAgency.id,
          patient_id: patient.id,
          referring_physician: row["referring_physician"] || null,
          pre_auth_amount: preAuthAmountStr ? parseFloat(preAuthAmountStr) : 0,
          pre_auth_mileage: row["pre_auth_mileage"] ? parseInt(row["pre_auth_mileage"], 10) : 0,
          po_number: poNumber,
          source: "import",
          status: "pending_offer",
        },
      });
      result.created++;
    } catch (err) {
      result.errors.push({ row: rowNum, message: (err as Error).message });
    }
  }

  return result;
}
