import { Router } from "express";
import { requirePermission } from "../../middleware/tenant.js";
import * as project from "./project.controller.js";

export const projectRouter = Router({ mergeParams: true });

projectRouter.get("/", requirePermission("workspace:read"), project.listProjects);
projectRouter.post("/", requirePermission("projects:create"), project.createProject);
projectRouter.get("/:projectId", requirePermission("workspace:read"), project.getProject);
projectRouter.patch("/:projectId", requirePermission("projects:update"), project.updateProject);
projectRouter.delete("/:projectId", requirePermission("projects:delete"), project.deleteProject);
projectRouter.get("/:projectId/members", requirePermission("workspace:read"), project.listProjectMembers);
projectRouter.post("/:projectId/members", requirePermission("projects:update"), project.addProjectMember);
projectRouter.delete("/:projectId/members/:userId", requirePermission("projects:update"), project.removeProjectMember);
