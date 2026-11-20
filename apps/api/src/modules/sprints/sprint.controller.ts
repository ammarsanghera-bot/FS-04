import { createSprintSchema, sprintTaskSchema, updateSprintSchema } from "@flowboard/shared";
import { parseOrThrow } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireTenant } from "../../middleware/tenant.js";
import { sprintService } from "./sprint.service.js";

export const listSprints = asyncHandler(async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  res.json({ sprints: await sprintService.list(requireTenant(req), projectId) });
});

export const createSprint = asyncHandler(async (req, res) => {
  res.status(201).json({ sprint: await sprintService.create(requireTenant(req), parseOrThrow(createSprintSchema, req.body)) });
});

export const updateSprint = asyncHandler(async (req, res) => {
  res.json({ sprint: await sprintService.update(requireTenant(req), String(req.params.sprintId), parseOrThrow(updateSprintSchema, req.body)) });
});

export const getSprint = asyncHandler(async (req, res) => {
  res.json(await sprintService.detail(requireTenant(req), String(req.params.sprintId)));
});

export const sprintReport = asyncHandler(async (req, res) => {
  res.json(await sprintService.report(requireTenant(req), String(req.params.sprintId)));
});

export const addSprintTask = asyncHandler(async (req, res) => {
  const body = parseOrThrow(sprintTaskSchema, req.body);
  await sprintService.addTask(requireTenant(req), String(req.params.sprintId), body.taskId);
  res.status(204).end();
});

export const removeSprintTask = asyncHandler(async (req, res) => {
  await sprintService.removeTask(requireTenant(req), String(req.params.sprintId), String(req.params.taskId));
  res.status(204).end();
});

export const startSprint = asyncHandler(async (req, res) => {
  res.json({ sprint: await sprintService.start(requireTenant(req), String(req.params.sprintId)) });
});

export const completeSprint = asyncHandler(async (req, res) => {
  res.json({ sprint: await sprintService.complete(requireTenant(req), String(req.params.sprintId)) });
});
