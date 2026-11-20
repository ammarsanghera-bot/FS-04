import type { NextFunction, Request, Response } from "express";
import type { Permission } from "@flowboard/shared";
import { hasPermission } from "@flowboard/shared";
import { Errors } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "./async-handler.js";

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const requireWorkspace = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) throw Errors.unauthorized();
  const workspaceId = routeParam(req.params.workspaceId);
  if (!workspaceId) throw Errors.badRequest("Workspace is required");

  const headerWorkspace = req.get("x-workspace-id");
  if (headerWorkspace && headerWorkspace !== workspaceId) {
    throw Errors.badRequest("Workspace header does not match the request");
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
    include: { workspace: true },
  });
  if (!membership || membership.workspace.deletedAt) {
    throw Errors.forbidden("You are not a member of this workspace");
  }

  req.tenant = {
    workspaceId,
    userId: req.user.id,
    role: membership.role,
    memberId: membership.id,
  };
  next();
});

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.tenant) return next(Errors.unauthorized());
    if (!hasPermission(req.tenant.role, permission)) {
      return next(Errors.forbidden());
    }
    return next();
  };
}

export function requireTenant(req: Request) {
  if (!req.tenant) throw Errors.unauthorized();
  return req.tenant;
}
