import { Router } from "express";
import { requirePermission } from "../../middleware/tenant.js";
import * as task from "./task.controller.js";

export const taskRouter = Router({ mergeParams: true });

taskRouter.get("/labels", requirePermission("workspace:read"), task.listLabels);
taskRouter.post("/labels", requirePermission("tasks:update"), task.createLabel);
taskRouter.get("/projects/:projectId/board", requirePermission("workspace:read"), task.getBoard);
taskRouter.get("/projects/:projectId/tasks", requirePermission("workspace:read"), task.listTasks);
taskRouter.post("/projects/:projectId/tasks", requirePermission("tasks:create"), task.createTask);
taskRouter.get("/tasks/:taskId", requirePermission("workspace:read"), task.getTask);
taskRouter.patch("/tasks/:taskId", requirePermission("tasks:update"), task.updateTask);
taskRouter.post("/tasks/:taskId/move", requirePermission("tasks:update"), task.moveTask);
taskRouter.delete("/tasks/:taskId", requirePermission("tasks:delete"), task.deleteTask);
