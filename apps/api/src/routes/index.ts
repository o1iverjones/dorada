import type { FastifyInstance } from "fastify";
import authRoutes from "./auth/auth.routes.js";
import adminUsersRoutes from "./admin-users/admin-users.routes.js";
import appointmentRoutes from "./appointments/appointments.routes.js";
import interpreterRoutes from "./interpreters/interpreters.routes.js";
import clinicRoutes from "./clinics/clinics.routes.js";
import insuranceAgencyRoutes from "./insurance-agencies/insurance-agencies.routes.js";
import patientRoutes from "./patients/patients.routes.js";
import reportRoutes from "./reports/reports.routes.js";
import messageRoutes from "./messages/messages.routes.js";
import settingsRoutes from "./settings/settings.routes.js";
import emailIntakeRoutes from "./email-intake/email-intake.routes.js";
import importRoutes from "./import/import.routes.js";
import invoiceRoutes from "./invoices/invoices.routes.js";
import insuranceCompanyRoutes from "./insurance-companies/insurance-companies.routes.js";
import alertRoutes from "./alerts/alerts.routes.js";

export async function registerRoutes(fastify: FastifyInstance) {
  await fastify.register(authRoutes, { prefix: "/auth" });
  await fastify.register(adminUsersRoutes);
  await fastify.register(appointmentRoutes, { prefix: "/appointments" });
  await fastify.register(interpreterRoutes, { prefix: "/interpreters" });
  await fastify.register(clinicRoutes, { prefix: "/clinics" });
  await fastify.register(insuranceAgencyRoutes, { prefix: "/insurance-agencies" });
  await fastify.register(patientRoutes, { prefix: "/patients" });
  await fastify.register(reportRoutes, { prefix: "/reports" });
  await fastify.register(messageRoutes, { prefix: "/messages" });
  await fastify.register(settingsRoutes, { prefix: "/settings" });
  await fastify.register(emailIntakeRoutes, { prefix: "/email-intake" });
  await fastify.register(importRoutes, { prefix: "/import" });
  await fastify.register(invoiceRoutes, { prefix: "/invoices" });
  await fastify.register(insuranceCompanyRoutes, { prefix: "/insurance-companies" });
  await fastify.register(alertRoutes, { prefix: "/alerts" });
}
