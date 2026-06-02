import { Worker, type Job } from "bullmq";
import type { PrismaClient } from "@prisma/client";
import { Emitter } from "@socket.io/redis-emitter";
import { redisConnection } from "../config.js";

interface LongAppointmentJobData {
  appointmentId: string;
  organizationId: string;
  alertMinutes: number;
}

export function createAdminAlertWorker(prisma: PrismaClient) {
  const emitter = new Emitter(redisConnection as unknown as ConstructorParameters<typeof Emitter>[0]);

  return new Worker<LongAppointmentJobData>(
    "admin-alert",
    async (job: Job<LongAppointmentJobData>) => {
      if (job.name !== "long-appointment") return;

      const { appointmentId, organizationId, alertMinutes } = job.data;

      // Only alert if appointment is still in progress (not clocked out)
      const appt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { status: true, clock_out_time: true, date_time: true, po_number: true },
      });

      if (!appt || appt.clock_out_time || appt.status === "completed") return;

      const hours = Math.floor(alertMinutes / 60);
      const mins = alertMinutes % 60;
      const durationStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      const dateStr = new Date(appt.date_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const poStr = appt.po_number ? ` (PO: ${appt.po_number})` : "";

      const alert = await prisma.adminAlert.create({
        data: {
          organization_id: organizationId,
          type: "long_appointment",
          appointment_id: appointmentId,
          message: `The ${dateStr} appointment${poStr} has exceeded ${durationStr} and is still in progress.`,
        },
      });

      emitter.to(`notify:${organizationId}`).emit("alert:new", { alert });
    },
    {
      connection: redisConnection,
      concurrency: 20,
    },
  );
}
