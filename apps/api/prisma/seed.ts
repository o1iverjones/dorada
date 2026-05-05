import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ── Organization ──────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Interpreters",
      slug: "demo",
      locale: "en",
      plan: "standard",
    },
  });

  console.log(`Organization: ${org.name} (${org.id})`);

  // ── Super Admin role ───────────────────────────────────────────────────────
  const superAdminRole = await prisma.role.upsert({
    where: { organization_id_name: { organization_id: org.id, name: "Super Admin" } },
    update: {},
    create: {
      organization_id: org.id,
      name: "Super Admin",
      is_system: true,
      permissions: {
        create: [
          { permission: "manage_interpreters" },
          { permission: "manage_clinics" },
          { permission: "manage_admin_users" },
          { permission: "view_reports" },
          { permission: "manage_appointments" },
          { permission: "manage_system_settings" },
        ],
      },
    },
  });

  console.log(`Role: ${superAdminRole.name} (${superAdminRole.id})`);

  // ── Admin user ─────────────────────────────────────────────────────────────
  const password = "Password123!";
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { organization_id_email: { organization_id: org.id, email: "admin@demo.com" } },
    update: {},
    create: {
      organization_id: org.id,
      name: "Demo Admin",
      email: "admin@demo.com",
      password_hash: passwordHash,
      role_id: superAdminRole.id,
      mfa_enabled: false,
    },
  });

  console.log(`Admin user: ${admin.email}`);

  // ── System settings ────────────────────────────────────────────────────────
  await prisma.systemSettings.upsert({
    where: { organization_id: org.id },
    update: {},
    create: {
      organization_id: org.id,
      default_pay_rate_certified: 40.0,
      default_pay_rate_qualified: 30.0,
      offer_expiry_default_minutes: 60,
      follow_up_reminder_window_minutes: 60,
      follow_up_max_reminders: 2,
    },
  });

  // ── Languages ──────────────────────────────────────────────────────────────
  for (const lang of [
    { code: "es", name: "Spanish" },
    { code: "zh", name: "Mandarin" },
    { code: "vi", name: "Vietnamese" },
    { code: "so", name: "Somali" },
    { code: "ar", name: "Arabic" },
  ]) {
    await prisma.organizationLanguage.upsert({
      where: { organization_id_code: { organization_id: org.id, code: lang.code } },
      update: {},
      create: { organization_id: org.id, ...lang },
    });
  }

  // ── Appointment types ──────────────────────────────────────────────────────
  for (const type of [
    { name: "In-Person", pay_model: "hourly", minimum_billable_minutes: 60 },
    { name: "Phone", pay_model: "flat_rate", minimum_billable_minutes: 30 },
    { name: "Video", pay_model: "flat_rate", minimum_billable_minutes: 30 },
  ]) {
    const existing = await prisma.appointmentType.findFirst({
      where: { organization_id: org.id, name: type.name },
    });
    if (!existing) {
      await prisma.appointmentType.create({ data: { organization_id: org.id, ...type } });
    }
  }

  // ── Sample clinic ──────────────────────────────────────────────────────────
  const clinic = await prisma.clinic.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      organization_id: org.id,
      name: "Riverside Medical Center",
      address: "123 Main St, Springfield, IL 62701",
      phone: "555-100-0001",
      billing_model: "hourly",
    },
  });

  console.log(`Clinic: ${clinic.name}`);

  // ── Sample insurance agency ────────────────────────────────────────────────
  const agency = await prisma.insuranceAgency.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      organization_id: org.id,
      name: "BlueCross Demo",
      email_intake_enabled: false,
    },
  });

  console.log(`Insurance agency: ${agency.name}`);

  // ── Sample interpreter ─────────────────────────────────────────────────────
  const interpreter = await prisma.interpreter.upsert({
    where: { organization_id_phone: { organization_id: org.id, phone: "+15550001234" } },
    update: {},
    create: {
      organization_id: org.id,
      name: "Maria Garcia",
      phone: "+15550001234",
      email: "maria@example.com",
      type: "Certified",
      languages: ["es"],
      follow_up_channel: "push",
    },
  });

  console.log(`Interpreter: ${interpreter.name} (${interpreter.phone})`);

  console.log("\n✓ Seed complete");
  console.log("─────────────────────────────────────");
  console.log("Admin login:  admin@demo.com");
  console.log("Password:     Password123!");
  console.log("─────────────────────────────────────");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
