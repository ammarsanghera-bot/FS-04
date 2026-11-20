import { AUDIT_ACTIONS, DEFAULT_COLUMNS, hasPermission } from "@flowboard/shared";
import type { CreateProjectInput, UpdateProjectInput } from "@flowboard/shared";
import { loadProject, type TenantContext } from "../../lib/access.js";
import { recordActivity } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { assertCanAdd } from "../../lib/limits.js";
import { presentUser, userSelect } from "../../lib/presenters.js";
import { prisma } from "../../lib/prisma.js";
import { activeProjectWhere } from "../../repositories/scoped.js";
import { assertWorkspaceUser } from "../../lib/access.js";
import { projectKeyFromName } from "../../lib/slug.js";

async function uniqueKey(workspaceId: string, requested?: string, name?: string, ignoreId?: string) {
  const base = (requested ?? projectKeyFromName(name ?? "PRJ")).toUpperCase();
  let key = base;
  let n = 1;
  while (
    await prisma.project.findFirst({
      where: { workspaceId, key, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
    })
  ) {
    n += 1;
    key = `${base.slice(0, 4)}${n}`.slice(0, 6);
  }
  return key;
}

function asDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

export const projectService = {
  async list(tenant: TenantContext, search?: string) {
    const memberOnly = !hasPermission(tenant.role, "projects:read_all");
    const projects = await prisma.project.findMany({
      where: activeProjectWhere(tenant.workspaceId, {
        name: search ? { contains: search, mode: "insensitive" } : undefined,
        members: memberOnly ? { some: { userId: tenant.userId } } : undefined,
      }),
      include: {
        lead: { select: userSelect },
        _count: { select: { tasks: { where: { deletedAt: null } }, members: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const ids = projects.map((project) => project.id);
    const done = await prisma.task.groupBy({
      by: ["projectId"],
      where: { workspaceId: tenant.workspaceId, projectId: { in: ids }, deletedAt: null, status: "DONE" },
      _count: true,
    });
    const doneMap = new Map(done.map((row) => [row.projectId, row._count]));
    return projects.map((project) => {
      const total = project._count.tasks;
      const completed = doneMap.get(project.id) ?? 0;
      return {
        id: project.id,
        name: project.name,
        key: project.key,
        description: project.description,
        status: project.status,
        startDate: project.startDate,
        deadline: project.deadline,
        lead: project.lead ? presentUser(project.lead) : null,
        memberCount: project._count.members,
        taskCount: total,
        completedCount: completed,
        progress: total === 0 ? 0 : Math.round((completed / total) * 100),
        updatedAt: project.updatedAt,
      };
    });
  },

  async create(tenant: TenantContext, input: CreateProjectInput) {
    await assertCanAdd(tenant.workspaceId, "projects");
    if (input.leadId) await assertWorkspaceUser(tenant.workspaceId, input.leadId);
    const key = await uniqueKey(tenant.workspaceId, input.key, input.name);
    const project = await prisma.project.create({
      data: {
        workspaceId: tenant.workspaceId,
        name: input.name.trim(),
        key,
        description: input.description,
        status: input.status ?? "PLANNING",
        startDate: asDate(input.startDate),
        deadline: asDate(input.deadline),
        leadId: input.leadId ?? tenant.userId,
        members: { create: { workspaceId: tenant.workspaceId, userId: input.leadId && input.leadId !== tenant.userId ? input.leadId : tenant.userId } },
        boards: {
          create: {
            workspaceId: tenant.workspaceId,
            name: "Board",
            columns: { create: DEFAULT_COLUMNS.map((column) => ({ ...column, workspaceId: tenant.workspaceId })) },
          },
        },
      },
    });
    if (input.leadId && input.leadId !== tenant.userId) {
      await prisma.projectMember.create({
        data: { projectId: project.id, workspaceId: tenant.workspaceId, userId: tenant.userId },
      }).catch(() => undefined);
    }
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "project",
      entityId: project.id,
      action: AUDIT_ACTIONS.PROJECT_CREATED,
      metadata: { name: project.name, key: project.key },
    });
    return project;
  },

  async get(tenant: TenantContext, projectId: string) {
    const project = await loadProject(tenant, projectId);
    const [members, tasks, overdue, upcoming, activity] = await Promise.all([
      prisma.projectMember.findMany({
        where: { projectId, workspaceId: tenant.workspaceId },
        include: { user: { select: userSelect } },
      }),
      prisma.task.findMany({
        where: { projectId, workspaceId: tenant.workspaceId, deletedAt: null },
        select: { status: true, dueDate: true },
      }),
      prisma.task.count({
        where: {
          projectId,
          workspaceId: tenant.workspaceId,
          deletedAt: null,
          status: { not: "DONE" },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.task.findMany({
        where: {
          projectId,
          workspaceId: tenant.workspaceId,
          deletedAt: null,
          status: { not: "DONE" },
          dueDate: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) },
        },
        orderBy: { dueDate: "asc" },
        take: 6,
        include: { project: { select: { key: true } } },
      }),
      prisma.activityLog.findMany({
        where: {
          workspaceId: tenant.workspaceId,
          OR: [
            { entityType: "project", entityId: projectId },
            { metadata: { path: ["projectId"], equals: projectId } },
          ],
        },
        include: { actor: { select: userSelect } },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === "DONE").length;
    const lead = project.leadId
      ? await prisma.user.findUnique({ where: { id: project.leadId }, select: userSelect })
      : null;
    return {
      project: {
        ...project,
        lead: lead ? presentUser(lead) : null,
      },
      members: members.map((member) => presentUser(member.user)),
      progress: {
        total,
        completed,
        overdue,
        percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      },
      upcomingDeadlines: upcoming.map((task) => ({
        id: task.id,
        identifier: `${task.project.key}-${task.number}`,
        title: task.title,
        dueDate: task.dueDate,
        status: task.status,
      })),
      recentActivity: activity.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: item.metadata,
        createdAt: item.createdAt,
        actor: item.actor ? presentUser(item.actor) : null,
      })),
    };
  },

  async update(tenant: TenantContext, projectId: string, input: UpdateProjectInput) {
    await loadProject(tenant, projectId);
    if (input.leadId) await assertWorkspaceUser(tenant.workspaceId, input.leadId);
    let key: string | undefined;
    if (input.key) key = await uniqueKey(tenant.workspaceId, input.key, undefined, projectId);
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: input.name?.trim(),
        key,
        description: input.description,
        status: input.status,
        startDate: asDate(input.startDate),
        deadline: asDate(input.deadline),
        leadId: input.leadId === undefined ? undefined : input.leadId,
      },
    });
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "project",
      entityId: project.id,
      action: input.status === "ARCHIVED" ? AUDIT_ACTIONS.PROJECT_ARCHIVED : AUDIT_ACTIONS.PROJECT_UPDATED,
      metadata: { name: project.name, status: project.status, projectId: project.id },
    });
    return project;
  },

  async remove(tenant: TenantContext, projectId: string) {
    const project = await loadProject(tenant, projectId);
    await prisma.project.update({
      where: { id: project.id },
      data: { deletedAt: new Date(), key: `${project.key}~${project.id.slice(0, 4)}`.slice(0, 12) },
    });
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "project",
      entityId: project.id,
      action: AUDIT_ACTIONS.PROJECT_DELETED,
      metadata: { name: project.name, projectId: project.id },
    });
  },

  async listMembers(tenant: TenantContext, projectId: string) {
    await loadProject(tenant, projectId);
    const members = await prisma.projectMember.findMany({
      where: { projectId, workspaceId: tenant.workspaceId },
      include: { user: { select: userSelect } },
    });
    return members.map((member) => presentUser(member.user));
  },

  async addMember(tenant: TenantContext, projectId: string, userId: string) {
    await loadProject(tenant, projectId);
    await assertWorkspaceUser(tenant.workspaceId, userId);
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: {},
      create: { projectId, userId, workspaceId: tenant.workspaceId },
    });
  },

  async removeProjectMember(tenant: TenantContext, projectId: string, userId: string) {
    await loadProject(tenant, projectId);
    await prisma.projectMember.deleteMany({ where: { projectId, userId, workspaceId: tenant.workspaceId } });
  },
};
