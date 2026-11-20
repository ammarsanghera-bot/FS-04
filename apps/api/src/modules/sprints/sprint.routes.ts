import { Router } from "express";
import { requirePermission } from "../../middleware/tenant.js";
import * as sprint from "./sprint.controller.js";

export const sprintRouter = Router({ mergeParams: true });

sprintRouter.get("/", requirePermission("workspace:read"), sprint.listSprints);
sprintRouter.post("/", requirePermission("sprints:manage"), sprint.createSprint);
sprintRouter.get("/:sprintId", requirePermission("workspace:read"), sprint.getSprint);
sprintRouter.patch("/:sprintId", requirePermission("sprints:manage"), sprint.updateSprint);
sprintRouter.post("/:sprintId/tasks", requirePermission("sprints:manage"), sprint.addSprintTask);
sprintRouter.delete("/:sprintId/tasks/:taskId", requirePermission("sprints:manage"), sprint.removeSprintTask);
sprintRouter.post("/:sprintId/start", requirePermission("sprints:manage"), sprint.startSprint);
sprintRouter.post("/:sprintId/complete", requirePermission("sprints:manage"), sprint.completeSprint);
sprintRouter.get("/:sprintId/report", requirePermission("reports:view"), sprint.sprintReport);
