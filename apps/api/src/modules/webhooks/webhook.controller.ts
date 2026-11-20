import { createWebhookSchema } from "@flowboard/shared";
import { parseOrThrow } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireTenant } from "../../middleware/tenant.js";
import { webhookService } from "./webhook.service.js";

export const listWebhooks = asyncHandler(async (req, res) => {
  res.json({ webhooks: await webhookService.list(requireTenant(req)) });
});

export const createWebhook = asyncHandler(async (req, res) => {
  res.status(201).json({ webhook: await webhookService.create(requireTenant(req), parseOrThrow(createWebhookSchema, req.body)) });
});

export const deleteWebhook = asyncHandler(async (req, res) => {
  await webhookService.remove(requireTenant(req), String(req.params.webhookId));
  res.status(204).end();
});
