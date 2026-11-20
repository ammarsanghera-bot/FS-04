import { Router } from "express";
import { requirePermission } from "../../middleware/tenant.js";
import * as report from "./report.controller.js";

export const reportRouter = Router({ mergeParams: true });
reportRouter.get("/dashboard", requirePermission("reports:view"), report.dashboard);
