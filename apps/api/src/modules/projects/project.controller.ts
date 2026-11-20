import { createProjectSchema, projectMemberSchema, updateProjectSchema } from "@flowboard/shared";
import { parseOrThrow } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireTenant } from "../../middleware/tenant.js";
import { projectService } from "./project.service.js";

export const listProjects = asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  res.json({ projects: await projectService.list(requireTenant(req), search) });
});

export const createProject = asyncHandler(async (req, res) => {
  const project = await projectService.create(requireTenant(req), parseOrThrow(createProjectSchema, req.body));
  res.status(201).json({ project });
});

export const getProject = asyncHandler(async (req, res) => {
  res.json(await projectService.get(requireTenant(req), String(req.params.projectId)));
});

export const updateProject = asyncHandler(async (req, res) => {
  res.json({ project: await projectService.update(requireTenant(req), String(req.params.projectId), parseOrThrow(updateProjectSchema, req.body)) });
});

export const deleteProject = asyncHandler(async (req, res) => {
  await projectService.remove(requireTenant(req), String(req.params.projectId));
  res.status(204).end();
});

export const listProjectMembers = asyncHandler(async (req, res) => {
  res.json({ members: await projectService.listMembers(requireTenant(req), String(req.params.projectId)) });
});

export const addProjectMember = asyncHandler(async (req, res) => {
  const body = parseOrThrow(projectMemberSchema, req.body);
  await projectService.addMember(requireTenant(req), String(req.params.projectId), body.userId);
  res.status(204).end();
});

export const removeProjectMember = asyncHandler(async (req, res) => {
  await projectService.removeProjectMember(requireTenant(req), String(req.params.projectId), String(req.params.userId));
  res.status(204).end();
});
