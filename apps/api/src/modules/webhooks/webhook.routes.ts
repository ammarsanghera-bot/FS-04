import { Router } from "express";
import { requirePermission } from "../../middleware/tenant.js";
import * as webhook from "./webhook.controller.js";

export const webhookRouter = Router({ mergeParams: true });
webhookRouter.get("/", requirePermission("webhooks:manage"), webhook.listWebhooks);
webhookRouter.post("/", requirePermission("webhooks:manage"), webhook.createWebhook);
webhookRouter.delete("/:webhookId", requirePermission("webhooks:manage"), webhook.deleteWebhook);
