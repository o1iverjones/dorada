import type { PrismaClient } from "@prisma/client";
import type {
  UpdateSystemSettingsBody,
  CreateAppointmentTypeBody,
  UpdateAppointmentTypeBody,
  UpdateLanguageListBody,
  UpdateLocalizationStringsBody,
} from "@dorada/types";
import { NotFoundError, ConflictError } from "../../lib/errors.js";

export async function getSettings(organizationId: string, prisma: PrismaClient) {
  const [settings, languages, appointmentTypes] = await Promise.all([
    prisma.systemSettings.findUnique({ where: { organization_id: organizationId } }),
    prisma.organizationLanguage.findMany({ where: { organization_id: organizationId }, orderBy: { name: "asc" } }),
    prisma.appointmentType.findMany({
      where: { organization_id: organizationId, is_active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    default_pay_rates: {
      certified: Number(settings?.default_pay_rate_certified ?? 40),
      qualified: Number(settings?.default_pay_rate_qualified ?? 30),
    },
    offer_expiry_default_minutes: settings?.offer_expiry_default_minutes ?? 60,
    follow_up_config: {
      non_response_window_minutes: settings?.follow_up_reminder_window_minutes ?? 60,
      max_reminders: settings?.follow_up_max_reminders ?? 2,
    },
    timezone: settings?.timezone ?? "America/Los_Angeles",
    allow_manual_confirm: settings?.allow_manual_confirm ?? false,
    show_language: settings?.show_language ?? true,
    languages,
    appointment_types: appointmentTypes,
  };
}

export async function updateSettings(body: UpdateSystemSettingsBody, organizationId: string, prisma: PrismaClient) {
  await prisma.systemSettings.upsert({
    where: { organization_id: organizationId },
    update: {
      ...(body.default_pay_rates ? {
        default_pay_rate_certified: body.default_pay_rates.certified,
        default_pay_rate_qualified: body.default_pay_rates.qualified,
      } : {}),
      ...(body.offer_expiry_default_minutes ? { offer_expiry_default_minutes: body.offer_expiry_default_minutes } : {}),
      ...(body.follow_up_config ? {
        follow_up_reminder_window_minutes: body.follow_up_config.non_response_window_minutes,
        follow_up_max_reminders: body.follow_up_config.max_reminders,
      } : {}),
      ...(body.timezone ? { timezone: body.timezone } : {}),
      ...(body.allow_manual_confirm !== undefined ? { allow_manual_confirm: body.allow_manual_confirm } : {}),
      ...(body.show_language !== undefined ? { show_language: body.show_language } : {}),
    },
    create: {
      organization_id: organizationId,
      default_pay_rate_certified: body.default_pay_rates?.certified ?? 40,
      default_pay_rate_qualified: body.default_pay_rates?.qualified ?? 30,
      offer_expiry_default_minutes: body.offer_expiry_default_minutes ?? 60,
      follow_up_reminder_window_minutes: body.follow_up_config?.non_response_window_minutes ?? 60,
      follow_up_max_reminders: body.follow_up_config?.max_reminders ?? 2,
      timezone: body.timezone ?? "America/Los_Angeles",
      allow_manual_confirm: body.allow_manual_confirm ?? false,
      show_language: body.show_language ?? true,
    },
  });

  return getSettings(organizationId, prisma);
}

export async function createAppointmentType(body: CreateAppointmentTypeBody, organizationId: string, prisma: PrismaClient) {
  return prisma.appointmentType.create({
    data: {
      organization_id: organizationId,
      name: body.name,
      pay_model: body.pay_model,
      minimum_billable_minutes: body.minimum_billable_minutes,
    },
  });
}

export async function updateAppointmentType(
  id: string,
  body: UpdateAppointmentTypeBody,
  organizationId: string,
  prisma: PrismaClient,
) {
  const type = await prisma.appointmentType.findUnique({ where: { id } });
  if (!type || type.organization_id !== organizationId) throw new NotFoundError("APPOINTMENT_TYPE_NOT_FOUND", "Not found");

  return prisma.appointmentType.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.pay_model ? { pay_model: body.pay_model } : {}),
      ...(body.minimum_billable_minutes ? { minimum_billable_minutes: body.minimum_billable_minutes } : {}),
    },
  });
}

export async function deactivateAppointmentType(id: string, organizationId: string, prisma: PrismaClient) {
  const type = await prisma.appointmentType.findUnique({ where: { id } });
  if (!type || type.organization_id !== organizationId) throw new NotFoundError("APPOINTMENT_TYPE_NOT_FOUND", "Not found");

  const upcoming = await prisma.appointment.count({
    where: { type_id: id, status: { in: ["confirmed", "in_progress"] }, date_time: { gte: new Date() } },
  });
  if (upcoming > 0) throw new ConflictError("HAS_UPCOMING_APPOINTMENTS", "Type has upcoming appointments");

  await prisma.appointmentType.update({ where: { id }, data: { is_active: false } });
}

export async function updateLanguages(body: UpdateLanguageListBody, organizationId: string, prisma: PrismaClient) {
  await prisma.$transaction(
    body.languages.map((lang) =>
      prisma.organizationLanguage.upsert({
        where: { organization_id_code: { organization_id: organizationId, code: lang.code } },
        update: { name: lang.name, active: lang.active },
        create: { organization_id: organizationId, code: lang.code, name: lang.name, active: lang.active },
      }),
    ),
  );

  return prisma.organizationLanguage.findMany({ where: { organization_id: organizationId }, orderBy: { name: "asc" } });
}

export async function listInterpreterRates(organizationId: string, prisma: PrismaClient) {
  const rates = await prisma.interpreterRate.findMany({
    where: { organization_id: organizationId, is_active: true },
    orderBy: { title: "asc" },
  });
  return { data: rates.map((r) => ({ id: r.id, title: r.title, amount: Number(r.amount) })) };
}

export async function createInterpreterRate(
  body: { title: string; amount: number },
  organizationId: string,
  prisma: PrismaClient,
) {
  const rate = await prisma.interpreterRate.create({
    data: { organization_id: organizationId, title: body.title, amount: body.amount },
  });
  return { id: rate.id, title: rate.title, amount: Number(rate.amount) };
}

export async function deleteInterpreterRate(id: string, organizationId: string, prisma: PrismaClient) {
  const rate = await prisma.interpreterRate.findUnique({ where: { id } });
  if (!rate || rate.organization_id !== organizationId) throw new NotFoundError("RATE_NOT_FOUND", "Rate not found");
  await prisma.interpreterRate.update({ where: { id }, data: { is_active: false } });
}

export async function getLocalizationStrings(locale: string, organizationId: string, prisma: PrismaClient) {
  const overrides = await prisma.localeString.findMany({
    where: { organization_id: organizationId, locale },
  });
  const strings = Object.fromEntries(overrides.map((o) => [o.key, o.value]));
  return { locale, strings };
}

export async function updateLocalizationStrings(
  locale: string,
  body: UpdateLocalizationStringsBody,
  organizationId: string,
  prisma: PrismaClient,
) {
  await prisma.$transaction(
    Object.entries(body.strings).map(([key, value]) =>
      value
        ? prisma.localeString.upsert({
            where: { organization_id_locale_key: { organization_id: organizationId, locale, key } },
            update: { value },
            create: { organization_id: organizationId, locale, key, value },
          })
        : prisma.localeString.deleteMany({ where: { organization_id: organizationId, locale, key } }),
    ),
  );

  return getLocalizationStrings(locale, organizationId, prisma);
}
