import { Router } from "express";
import { requirePermission } from "../../middleware/tenant.js";
import * as billing from "./billing.controller.js";

export const billingRouter = Router({ mergeParams: true });

billingRouter.get("/", requirePermission("workspace:read"), billing.getBilling);
billingRouter.post("/checkout", requirePermission("billing:manage"), billing.checkout);
billingRouter.post("/portal", requirePermission("billing:manage"), billing.portal);
billingRouter.post("/mock-activate", requirePermission("billing:manage"), billing.mockActivate);
billingRouter.post("/cancel", requirePermission("billing:manage"), billing.cancel);
