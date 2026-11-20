import { createHmac, randomBytes } from "node:crypto";
import { Errors } from "../../lib/errors.js";
import { getWorkspaceSubscription } from "../../lib/limits.js";
import { prisma } from "../../lib/prisma.js";
import type { TenantContext } from "../../lib/access.js";

async function assertIntegrations(workspaceId: string) {
  const subscription = await getWorkspaceSubscription(workspaceId);
  if (!subscription.plan.customIntegrations) {
    throw Errors.planLimit("Custom integrations are included with the Business plan.");
  }
}

export const webhookService = {
  async list(tenant: TenantContext) {
    const hooks = await prisma.webhook.findMany({
      where: { workspaceId: tenant.workspaceId },
      orderBy: { createdAt: "desc" },
      include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    return hooks.map((hook) => ({
      id: hook.id,
      url: hook.url,
      events: hook.events,
      active: hook.active,
      createdAt: hook.createdAt,
      deliveries: hook.deliveries,
    }));
  },

  async create(tenant: TenantContext, input: { url: string; events: string[] }) {
    await assertIntegrations(tenant.workspaceId);
    const secret = randomBytes(24).toString("hex");
    const hook = await prisma.webhook.create({
      data: { workspaceId: tenant.workspaceId, url: input.url, events: input.events, secret },
    });
    return { id: hook.id, url: hook.url, events: hook.events, secret, active: hook.active };
  },

  async remove(tenant: TenantContext, webhookId: string) {
    const result = await prisma.webhook.deleteMany({ where: { id: webhookId, workspaceId: tenant.workspaceId } });
    if (result.count === 0) throw Errors.notFound("Webhook not found");
  },

  async deliver(workspaceId: string, event: string, payload: unknown) {
    const subscription = await prisma.subscription.findUnique({ where: { workspaceId }, include: { plan: true } });
    if (!subscription?.plan.customIntegrations) return;
    const hooks = await prisma.webhook.findMany({ where: { workspaceId, active: true } });
    for (const hook of hooks) {
      if (!hook.events.includes(event) && !hook.events.includes("*")) continue;
      const body = JSON.stringify({ event, payload, sentAt: new Date().toISOString() });
      const signature = createHmac("sha256", hook.secret).update(body).digest("hex");
      let status = "failed";
      let responseCode: number | null = null;
      try {
        const response = await fetch(hook.url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-flowboard-signature": signature },
          body,
        });
        responseCode = response.status;
        status = response.ok ? "delivered" : "failed";
      } catch {
        status = "failed";
      }
      await prisma.webhookEvent.create({
        data: { webhookId: hook.id, workspaceId, event, payload: payload as object, status, responseCode },
      });
    }
  },
};
