import type { WorkspaceRole } from "@flowboard/shared";
import { hasPermission } from "@flowboard/shared";
import { Errors } from "./errors.js";
import { prisma } from "./prisma.js";

export interface TenantContext {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  memberId: string;
}

export async function loadProject(tenant: TenantContext, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: tenant.workspaceId, deletedAt: null },
  });
  if (!project) throw Errors.notFound("Project not found");
  if (!hasPermission(tenant.role, "projects:read_all")) {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId: tenant.userId, workspaceId: tenant.workspaceId },
    });
    if (!membership) throw Errors.notFound("Project not found");
  }
  return project;
}

export async function loadTask(tenant: TenantContext, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId: tenant.workspaceId, deletedAt: null },
  });
  if (!task) throw Errors.notFound("Task not found");
  await loadProject(tenant, task.projectId);
  return task;
}

export async function assertWorkspaceUser(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) throw Errors.badRequest("That person is not a member of this workspace");
  return member;
}
