import { enqueue } from "./jobs.js";

export async function dispatchWebhooks(workspaceId: string, event: string, payload: Record<string, unknown>) {
  await enqueue("webhooks.deliver", { workspaceId, event, payload });
}
