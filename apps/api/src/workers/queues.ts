import { Queue } from "bullmq";
import type { RedisOptions } from "ioredis";
import { config } from "../config.js";

let queues: ReturnType<typeof createQueues> | null = null;

function createQueues() {
  const connection: RedisOptions = { host: config.REDIS_HOST, port: config.REDIS_PORT };

  return {
    appointmentRemindersQueue: new Queue("appointment-reminders", { connection }),
    followUpFlowQueue: new Queue("follow-up-flow", { connection }),
    reportGenerationQueue: new Queue("report-generation", { connection }),
    emailIntakeQueue: new Queue("email-intake", { connection }),
    adminAlertQueue: new Queue("admin-alert", { connection }),
  };
}

export function getQueues() {
  if (!queues) {
    queues = createQueues();
  }
  return queues;
}

export type Queues = ReturnType<typeof createQueues>;
