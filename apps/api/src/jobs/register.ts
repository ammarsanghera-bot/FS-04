import { env } from "../config/env.js";
import { registerJob, scheduleJob, startJobQueue } from "../lib/jobs.js";
import { billingService } from "../modules/billing/billing.service.js";
import { webhookService } from "../modules/webhooks/webhook.service.js";
import { scanDeadlines } from "./maintenance.js";

export async function bootJobs() {
  registerJob("deadlines.scan", async () => {
    await scanDeadlines();
  });
  registerJob("billing.sweep", async () => {
    await billingService.sweepExpiredCancellations();
  });
  registerJob("webhooks.deliver", async (payload) => {
    const data = payload as { workspaceId: string; event: string; payload: unknown };
    if (!data?.workspaceId || !data.event) return;
    await webhookService.deliver(data.workspaceId, data.event, data.payload);
  });
  await startJobQueue();
  await scheduleJob("deadlines.scan", env.JOB_INTERVAL_MS);
  await scheduleJob("billing.sweep", env.JOB_INTERVAL_MS);
}
