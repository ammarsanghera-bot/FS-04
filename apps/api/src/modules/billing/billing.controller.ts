import { cancelSubscriptionSchema, checkoutSchema, mockActivateSchema } from "@flowboard/shared";
import { parseOrThrow } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireTenant } from "../../middleware/tenant.js";
import { billingService } from "./billing.service.js";

export const listPlans = asyncHandler(async (_req, res) => {
  res.json({ plans: await billingService.listPlans(), mode: billingService.mode });
});

export const getBilling = asyncHandler(async (req, res) => {
  res.json(await billingService.get(requireTenant(req)));
});

export const checkout = asyncHandler(async (req, res) => {
  const body = parseOrThrow(checkoutSchema, req.body);
  res.json(await billingService.checkout(requireTenant(req), body.planTier));
});

export const portal = asyncHandler(async (req, res) => {
  res.json(await billingService.portal(requireTenant(req)));
});

export const mockActivate = asyncHandler(async (req, res) => {
  const body = parseOrThrow(mockActivateSchema, req.body);
  res.json(await billingService.mockActivate(requireTenant(req), body.planTier));
});

export const cancel = asyncHandler(async (req, res) => {
  const body = parseOrThrow(cancelSubscriptionSchema, req.body);
  res.json(await billingService.cancel(requireTenant(req), body.when));
});

export const webhook = asyncHandler(async (req, res) => {
  const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  res.json(await billingService.handleWebhook(payload, req.get("stripe-signature")));
});
