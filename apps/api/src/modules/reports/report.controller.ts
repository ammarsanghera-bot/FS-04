import { reportQuerySchema } from "@flowboard/shared";
import { parseOrThrow } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireTenant } from "../../middleware/tenant.js";
import { reportService } from "./report.service.js";

export const dashboard = asyncHandler(async (req, res) => {
  res.json(await reportService.dashboard(requireTenant(req), parseOrThrow(reportQuerySchema, req.query)));
});
