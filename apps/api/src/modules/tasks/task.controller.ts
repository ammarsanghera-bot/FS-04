import { createLabelSchema, createTaskSchema, moveTaskSchema, taskQuerySchema, updateTaskSchema } from "@flowboard/shared";
import { parseOrThrow } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireTenant } from "../../middleware/tenant.js";
import { taskService } from "./task.service.js";

export const listTasks = asyncHandler(async (req, res) => {
  const query = parseOrThrow(taskQuerySchema, req.query);
  res.json({ tasks: await taskService.list(requireTenant(req), String(req.params.projectId), query) });
});

export const getBoard = asyncHandler(async (req, res) => {
  const query = parseOrThrow(taskQuerySchema, req.query);
  res.json(await taskService.board(requireTenant(req), String(req.params.projectId), query));
});

export const createTask = asyncHandler(async (req, res) => {
  const task = await taskService.create(requireTenant(req), String(req.params.projectId), parseOrThrow(createTaskSchema, req.body));
  res.status(201).json({ task });
});

export const getTask = asyncHandler(async (req, res) => {
  res.json(await taskService.get(requireTenant(req), String(req.params.taskId)));
});

export const updateTask = asyncHandler(async (req, res) => {
  res.json({ task: await taskService.update(requireTenant(req), String(req.params.taskId), parseOrThrow(updateTaskSchema, req.body)) });
});

export const moveTask = asyncHandler(async (req, res) => {
  res.json({ task: await taskService.move(requireTenant(req), String(req.params.taskId), parseOrThrow(moveTaskSchema, req.body)) });
});

export const deleteTask = asyncHandler(async (req, res) => {
  await taskService.remove(requireTenant(req), String(req.params.taskId));
  res.status(204).end();
});

export const listLabels = asyncHandler(async (req, res) => {
  res.json({ labels: await taskService.listLabels(requireTenant(req)) });
});

export const createLabel = asyncHandler(async (req, res) => {
  res.status(201).json({ label: await taskService.createLabel(requireTenant(req), parseOrThrow(createLabelSchema, req.body)) });
});
