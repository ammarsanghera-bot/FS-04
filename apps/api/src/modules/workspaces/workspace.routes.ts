import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireWorkspace } from "../../middleware/tenant.js";
import * as workspace from "./workspace.controller.js";

export const workspaceRouter = Router();
export const invitationRouter = Router();

invitationRouter.get("/preview", workspace.previewInvitation);
invitationRouter.post("/accept", authenticate, workspace.acceptInvitation);

workspaceRouter.get("/", authenticate, workspace.listWorkspaces);
workspaceRouter.post("/", authenticate, workspace.createWorkspace);

const scoped = Router({ mergeParams: true });
scoped.use(authenticate, requireWorkspace);
scoped.get("/", requirePermission("workspace:read"), workspace.getWorkspace);
scoped.patch("/", requirePermission("workspace:update"), workspace.updateWorkspace);
scoped.delete("/", requirePermission("workspace:delete"), workspace.deleteWorkspace);
scoped.post("/switch", requirePermission("workspace:read"), workspace.switchWorkspace);
scoped.get("/members", requirePermission("members:read"), workspace.listMembers);
scoped.patch("/members/:memberId", requirePermission("members:manage"), workspace.updateMember);
scoped.delete("/members/:memberId", requirePermission("members:read"), workspace.removeMember);
scoped.get("/invitations", requirePermission("members:read"), workspace.listInvitations);
scoped.post("/invitations", requirePermission("members:manage"), workspace.inviteMember);
scoped.post("/invitations/:invitationId/resend", requirePermission("members:manage"), workspace.resendInvitation);
scoped.delete("/invitations/:invitationId", requirePermission("members:manage"), workspace.cancelInvitation);

workspaceRouter.use("/:workspaceId", scoped);

export const workspaceScoped = scoped;
