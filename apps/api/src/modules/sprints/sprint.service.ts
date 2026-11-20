import { AUDIT_ACTIONS } from "@flowboard/shared";
import type { CreateSprintInput, UpdateSprintInput } from "@flowboard/shared";
import { loadProject, loadTask, type TenantContext } from "../../lib/access.js";
import { recordActivity } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { notifyUsers } from "../../lib/notify.js";
import { presentTask, presentUser, taskInclude, userSelect } from "../../lib/presenters.js";
import { prisma } from "../../lib/prisma.js";
import { dispatchWebhooks } from "../../lib/webhooks.js";

function asDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

async function loadSprint(tenant: TenantContext, sprintId: string) {
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, workspaceId: tenant.workspaceId },
  });
  if (!sprint) throw Errors.notFound("Sprint not found");
  await loadProject(tenant, sprint.projectId);
  return sprint;
}

export const sprintService = {
  async list(tenant: TenantContext, projectId?: string) {
    if (projectId) await loadProject(tenant, projectId);
    const sprints = await prisma.sprint.findMany({
      where: { workspaceId: tenant.workspaceId, projectId },
      include: {
        project: { select: { id: true, name: true, key: true } },
        tasks: { include: { task: { select: { status: true, deletedAt: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return sprints.map((sprint) => {
      const live = sprint.tasks.filter((item) => !item.task.deletedAt);
      const completed = live.filter((item) => item.task.status === "DONE").length;
      return {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        status: sprint.status,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        project: sprint.project,
        total: live.length,
        completed,
        percent: live.length === 0 ? 0 : Math.round((completed / live.length) * 100),
      };
    });
  },

  async create(tenant: TenantContext, input: CreateSprintInput) {
    await loadProject(tenant, input.projectId);
    const sprint = await prisma.sprint.create({
      data: {
        workspaceId: tenant.workspaceId,
        projectId: input.projectId,
        name: input.name.trim(),
        goal: input.goal,
        startDate: asDate(input.startDate),
        endDate: asDate(input.endDate),
      },
    });
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "sprint",
      entityId: sprint.id,
      action: AUDIT_ACTIONS.SPRINT_CREATED,
      metadata: { name: sprint.name, projectId: sprint.projectId },
    });
    return sprint;
  },

  async update(tenant: TenantContext, sprintId: string, input: UpdateSprintInput) {
    await loadSprint(tenant, sprintId);
    return prisma.sprint.update({
      where: { id: sprintId },
      data: {
        name: input.name?.trim(),
        goal: input.goal,
        startDate: asDate(input.startDate),
        endDate: asDate(input.endDate),
      },
    });
  },

  async addTask(tenant: TenantContext, sprintId: string, taskId: string) {
    const sprint = await loadSprint(tenant, sprintId);
    const task = await loadTask(tenant, taskId);
    if (task.projectId !== sprint.projectId) throw Errors.badRequest("Task belongs to another project");
    await prisma.sprintTask.deleteMany({ where: { taskId, workspaceId: tenant.workspaceId } });
    await prisma.sprintTask.create({ data: { sprintId, taskId, workspaceId: tenant.workspaceId } });
  },

  async removeTask(tenant: TenantContext, sprintId: string, taskId: string) {
    await loadSprint(tenant, sprintId);
    await prisma.sprintTask.deleteMany({ where: { sprintId, taskId, workspaceId: tenant.workspaceId } });
  },

  async start(tenant: TenantContext, sprintId: string) {
    const sprint = await loadSprint(tenant, sprintId);
    if (sprint.status !== "PLANNED") throw Errors.badRequest("Only a planned sprint can be started");
    const active = await prisma.sprint.findFirst({
      where: { workspaceId: tenant.workspaceId, projectId: sprint.projectId, status: "ACTIVE" },
    });
    if (active) throw Errors.conflict("This project already has an active sprint");
    const updated = await prisma.sprint.update({
      where: { id: sprint.id },
      data: { status: "ACTIVE", startDate: sprint.startDate ?? new Date() },
    });
    const members = await prisma.projectMember.findMany({ where: { projectId: sprint.projectId, workspaceId: tenant.workspaceId } });
    await notifyUsers({
      workspaceId: tenant.workspaceId,
      userIds: members.map((member) => member.userId),
      exceptUserId: tenant.userId,
      type: "SPRINT_STARTED",
      title: `${sprint.name} started`,
      body: sprint.goal || "The sprint is now active.",
      link: `/app/sprints/${sprint.id}`,
      metadata: { sprintId: sprint.id, projectId: sprint.projectId },
    });
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "sprint",
      entityId: sprint.id,
      action: AUDIT_ACTIONS.SPRINT_STARTED,
      metadata: { name: sprint.name, projectId: sprint.projectId },
    });
    await dispatchWebhooks(tenant.workspaceId, "sprint.started", { sprintId: sprint.id, projectId: sprint.projectId });
    return updated;
  },

  async complete(tenant: TenantContext, sprintId: string) {
    const sprint = await loadSprint(tenant, sprintId);
    if (sprint.status !== "ACTIVE") throw Errors.badRequest("Only an active sprint can be completed");
    const updated = await prisma.sprint.update({
      where: { id: sprint.id },
      data: { status: "COMPLETED", endDate: sprint.endDate ?? new Date() },
    });
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "sprint",
      entityId: sprint.id,
      action: AUDIT_ACTIONS.SPRINT_COMPLETED,
      metadata: { name: sprint.name, projectId: sprint.projectId },
    });
    return updated;
  },

  async detail(tenant: TenantContext, sprintId: string) {
    const sprint = await loadSprint(tenant, sprintId);
    const links = await prisma.sprintTask.findMany({
      where: { sprintId, workspaceId: tenant.workspaceId, task: { deletedAt: null } },
      include: { task: { include: taskInclude } },
    });
    const tasks = links.map((link) => presentTask(link.task));
    const backlog = await prisma.task.findMany({
      where: {
        workspaceId: tenant.workspaceId,
        projectId: sprint.projectId,
        deletedAt: null,
        sprintTasks: { none: { sprint: { status: { in: ["PLANNED", "ACTIVE"] } } } },
      },
      include: taskInclude,
      orderBy: { position: "asc" },
      take: 100,
    });
    return {
      sprint,
      tasks,
      backlog: backlog.map(presentTask),
      report: this.reportFrom(tasks),
    };
  },

  reportFrom(tasks: Array<{ status: string }>) {
    const byStatus = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].map((status) => ({
      status,
      count: tasks.filter((task) => task.status === status).length,
    }));
    const completed = tasks.filter((task) => task.status === "DONE").length;
    return {
      total: tasks.length,
      completed,
      incomplete: tasks.length - completed,
      percent: tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100),
      byStatus,
    };
  },

  async report(tenant: TenantContext, sprintId: string) {
    const detail = await this.detail(tenant, sprintId);
    const project = await prisma.project.findUnique({ where: { id: detail.sprint.projectId }, select: { name: true, key: true } });
    const members = await prisma.projectMember.findMany({
      where: { projectId: detail.sprint.projectId },
      include: { user: { select: userSelect } },
    });
    return {
      sprint: detail.sprint,
      project,
      report: detail.report,
      tasks: detail.tasks,
      members: members.map((member) => presentUser(member.user)),
    };
  },
};
