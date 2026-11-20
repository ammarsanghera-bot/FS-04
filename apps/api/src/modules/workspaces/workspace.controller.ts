import { createWorkspaceSchema, inviteMemberSchema, updateMemberRoleSchema, updateWorkspaceSchema, acceptInvitationSchema } from "@flowboard/shared";
import { parseOrThrow } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireTenant } from "../../middleware/tenant.js";
import { workspaceService } from "./workspace.service.js";

export const listWorkspaces = asyncHandler(async (req, res) => {
  res.json({ workspaces: await workspaceService.list(req.user!.id) });
});

export const createWorkspace = asyncHandler(async (req, res) => {
  res.status(201).json({ workspace: await workspaceService.create(req.user!.id, parseOrThrow(createWorkspaceSchema, req.body)) });
});

export const getWorkspace = asyncHandler(async (req, res) => {
  res.json({ workspace: await workspaceService.get(requireTenant(req)) });
});

export const updateWorkspace = asyncHandler(async (req, res) => {
  res.json({ workspace: await workspaceService.update(requireTenant(req), parseOrThrow(updateWorkspaceSchema, req.body)) });
});

export const deleteWorkspace = asyncHandler(async (req, res) => {
  await workspaceService.remove(requireTenant(req));
  res.status(204).end();
});

export const switchWorkspace = asyncHandler(async (req, res) => {
  res.json({ workspace: await workspaceService.switch(requireTenant(req)) });
});

export const listMembers = asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const role = typeof req.query.role === "string" ? req.query.role : undefined;
  res.json({ members: await workspaceService.listMembers(requireTenant(req), search, role) });
});

export const updateMember = asyncHandler(async (req, res) => {
  const body = parseOrThrow(updateMemberRoleSchema, req.body);
  res.json({ member: await workspaceService.updateMemberRole(requireTenant(req), String(req.params.memberId), body.role) });
});

export const removeMember = asyncHandler(async (req, res) => {
  await workspaceService.removeMember(requireTenant(req), String(req.params.memberId));
  res.status(204).end();
});

export const inviteMember = asyncHandler(async (req, res) => {
  res.status(201).json({ invitation: await workspaceService.invite(requireTenant(req), parseOrThrow(inviteMemberSchema, req.body)) });
});

export const listInvitations = asyncHandler(async (req, res) => {
  res.json({ invitations: await workspaceService.listInvitations(requireTenant(req)) });
});

export const resendInvitation = asyncHandler(async (req, res) => {
  res.json({ invitation: await workspaceService.resendInvitation(requireTenant(req), String(req.params.invitationId)) });
});

export const cancelInvitation = asyncHandler(async (req, res) => {
  await workspaceService.cancelInvitation(requireTenant(req), String(req.params.invitationId));
  res.status(204).end();
});

export const previewInvitation = asyncHandler(async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  res.json({ invitation: await workspaceService.previewInvitation(token) });
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const body = parseOrThrow(acceptInvitationSchema, req.body);
  res.json(await workspaceService.acceptInvitation(req.user!.id, body.token));
});
