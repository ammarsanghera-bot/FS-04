import { AUDIT_ACTIONS, hasPermission } from "@flowboard/shared";
import type { CreateLabelInput, CreateTaskInput, MoveTaskInput, TaskQuery, UpdateTaskInput } from "@flowboard/shared";
import type { Prisma, TaskStatus } from "@prisma/client";
import { loadProject, loadTask, type TenantContext, assertWorkspaceUser } from "../../lib/access.js";
import { recordActivity } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { assertCanAdd } from "../../lib/limits.js";
import { notifyUsers } from "../../lib/notify.js";
import { positionBetween } from "../../lib/position.js";
import { presentTask, presentUser, taskInclude } from "../../lib/presenters.js";
import { prisma } from "../../lib/prisma.js";
import { activeTaskWhere } from "../../repositories/scoped.js";
import { dispatchWebhooks } from "../../lib/webhooks.js";

function asDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function filters(tenant: TenantContext, query: TaskQuery, projectId?: string): Prisma.TaskWhereInput {
  const due: Prisma.DateTimeNullableFilter | undefined =
    query.dueBefore || query.dueAfter
      ? {
          lte: query.dueBefore ? new Date(query.dueBefore) : undefined,
          gte: query.dueAfter ? new Date(query.dueAfter) : undefined,
        }
      : undefined;
  return {
    projectId,
    status: query.status,
    priority: query.priority,
    assigneeId: query.assigneeId === "me" ? tenant.userId : query.assigneeId || undefined,
    dueDate: due,
    labels: query.labelId ? { some: { labelId: query.labelId, workspaceId: tenant.workspaceId } } : undefined,
    sprintTasks: query.sprintId ? { some: { sprintId: query.sprintId, workspaceId: tenant.workspaceId } } : undefined,
    OR: query.search
      ? [
          { title: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
        ]
      : undefined,
  };
}

async function columnFor(workspaceId: string, projectId: string, status: TaskStatus) {
  const column = await prisma.boardColumn.findFirst({
    where: { workspaceId, status, board: { projectId, workspaceId } },
  });
  if (!column) throw Errors.badRequest("That status is not on the board");
  return column;
}

async function replaceLabels(workspaceId: string, taskId: string, labelIds: string[]) {
  const labels = await prisma.taskLabel.findMany({ where: { workspaceId, id: { in: labelIds } } });
  if (labels.length !== labelIds.length) throw Errors.badRequest("One or more labels are not in this workspace");
  await prisma.taskLabelAssignment.deleteMany({ where: { taskId, workspaceId } });
  if (labelIds.length) {
    await prisma.taskLabelAssignment.createMany({
      data: labelIds.map((labelId) => ({ taskId, labelId, workspaceId })),
    });
  }
}

async function setSprint(tenant: TenantContext, taskId: string, projectId: string, sprintId: string | null) {
  await prisma.sprintTask.deleteMany({ where: { taskId, workspaceId: tenant.workspaceId } });
  if (!sprintId) return;
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, workspaceId: tenant.workspaceId, projectId },
  });
  if (!sprint) throw Errors.badRequest("Sprint not found in this project");
  await prisma.sprintTask.create({ data: { sprintId, taskId, workspaceId: tenant.workspaceId } });
}

async function readTask(tenant: TenantContext, taskId: string) {
  await loadTask(tenant, taskId);
  const task = await prisma.task.findFirst({
    where: activeTaskWhere(tenant.workspaceId, { id: taskId }),
    include: taskInclude,
  });
  if (!task) throw Errors.notFound("Task not found");
  return presentTask(task);
}

export const taskService = {
  async list(tenant: TenantContext, projectId: string, query: TaskQuery) {
    await loadProject(tenant, projectId);
    const tasks = await prisma.task.findMany({
      where: activeTaskWhere(tenant.workspaceId, filters(tenant, query, projectId)),
      include: taskInclude,
      orderBy: [{ status: "asc" }, { position: "asc" }],
    });
    return tasks.map(presentTask);
  },

  async board(tenant: TenantContext, projectId: string, query: TaskQuery) {
    await loadProject(tenant, projectId);
    const board = await prisma.board.findFirst({
      where: { projectId, workspaceId: tenant.workspaceId },
      include: { columns: { orderBy: { position: "asc" } } },
    });
    if (!board) throw Errors.notFound("Board not found");
    const tasks = await prisma.task.findMany({
      where: activeTaskWhere(tenant.workspaceId, filters(tenant, query, projectId)),
      include: taskInclude,
      orderBy: { position: "asc" },
    });
    const presented = tasks.map(presentTask);
    return {
      board: { id: board.id, name: board.name, projectId },
      columns: board.columns.map((column) => ({
        id: column.id,
        name: column.name,
        status: column.status,
        position: column.position,
        tasks: presented.filter((task) => task.status === column.status),
      })),
    };
  },

  async create(tenant: TenantContext, projectId: string, input: CreateTaskInput) {
    await loadProject(tenant, projectId);
    if (!hasPermission(tenant.role, "tasks:create")) throw Errors.forbidden();
    await assertCanAdd(tenant.workspaceId, "tasks");
    if (input.assigneeId) await assertWorkspaceUser(tenant.workspaceId, input.assigneeId);
    const status = input.status ?? "BACKLOG";
    const column = await columnFor(tenant.workspaceId, projectId, status);
    const [maxPosition, maxNumber] = await Promise.all([
      prisma.task.aggregate({
        where: { workspaceId: tenant.workspaceId, projectId, status, deletedAt: null },
        _max: { position: true },
      }),
      prisma.task.aggregate({ where: { projectId }, _max: { number: true } }),
    ]);
    const task = await prisma.task.create({
      data: {
        workspaceId: tenant.workspaceId,
        projectId,
        boardColumnId: column.id,
        number: (maxNumber._max.number ?? 0) + 1,
        title: input.title.trim(),
        description: input.description,
        status,
        priority: input.priority ?? "MEDIUM",
        position: (maxPosition._max.position ?? 0) + 1024,
        assigneeId: input.assigneeId ?? null,
        reporterId: tenant.userId,
        startDate: asDate(input.startDate),
        dueDate: asDate(input.dueDate),
        estimateHours: input.estimateHours ?? null,
        completedAt: status === "DONE" ? new Date() : null,
      },
    });
    if (input.labelIds?.length) await replaceLabels(tenant.workspaceId, task.id, input.labelIds);
    if (input.sprintId) await setSprint(tenant, task.id, projectId, input.sprintId);
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "task",
      entityId: task.id,
      action: AUDIT_ACTIONS.TASK_CREATED,
      metadata: { title: task.title, projectId, status },
    });
    if (input.assigneeId) {
      await notifyUsers({
        workspaceId: tenant.workspaceId,
        userIds: [input.assigneeId],
        exceptUserId: tenant.userId,
        type: "TASK_ASSIGNED",
        title: "Task assigned to you",
        body: input.title,
        link: `/app/projects/${projectId}/board?task=${task.id}`,
        metadata: { taskId: task.id, projectId },
      });
      await recordActivity({
        workspaceId: tenant.workspaceId,
        actorId: tenant.userId,
        entityType: "task",
        entityId: task.id,
        action: AUDIT_ACTIONS.TASK_ASSIGNED,
        metadata: { assigneeId: input.assigneeId, projectId },
      });
    }
    await dispatchWebhooks(tenant.workspaceId, "task.created", { taskId: task.id, projectId });
    return readTask(tenant, task.id);
  },

  async get(tenant: TenantContext, taskId: string) {
    const task = await readTask(tenant, taskId);
    const [comments, attachments, activity] = await Promise.all([
      prisma.comment.findMany({
        where: { taskId, workspaceId: tenant.workspaceId, deletedAt: null },
        include: { author: { select: { id: true, email: true, name: true, avatarKey: true, emailVerifiedAt: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.attachment.findMany({
        where: { taskId, workspaceId: tenant.workspaceId },
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.findMany({
        where: { workspaceId: tenant.workspaceId, entityType: "task", entityId: taskId },
        include: { actor: { select: { id: true, name: true, email: true, avatarKey: true, emailVerifiedAt: true } } },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);
    return {
      task,
      comments: comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: presentUser(comment.author),
      })),
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: attachment.createdAt,
        uploadedBy: { id: attachment.uploadedBy.id, name: attachment.uploadedBy.name },
      })),
      activity: activity.map((item) => ({
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

  async update(tenant: TenantContext, taskId: string, input: UpdateTaskInput) {
    const existing = await loadTask(tenant, taskId);
    if (input.assigneeId) await assertWorkspaceUser(tenant.workspaceId, input.assigneeId);
    let columnId: string | undefined;
    if (input.status && input.status !== existing.status) {
      columnId = (await columnFor(tenant.workspaceId, existing.projectId, input.status)).id;
    }
    const completedAt =
      input.status === undefined
        ? undefined
        : input.status === "DONE"
          ? existing.completedAt ?? new Date()
          : null;
    await prisma.task.update({
      where: { id: existing.id },
      data: {
        title: input.title?.trim(),
        description: input.description,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId === undefined ? undefined : input.assigneeId,
        startDate: asDate(input.startDate),
        dueDate: asDate(input.dueDate),
        estimateHours: input.estimateHours === undefined ? undefined : input.estimateHours,
        boardColumnId: columnId,
        completedAt,
      },
    });
    if (input.labelIds) await replaceLabels(tenant.workspaceId, existing.id, input.labelIds);
    if (input.sprintId !== undefined) await setSprint(tenant, existing.id, existing.projectId, input.sprintId);
    if (input.status && input.status !== existing.status) {
      await recordActivity({
        workspaceId: tenant.workspaceId,
        actorId: tenant.userId,
        entityType: "task",
        entityId: existing.id,
        action: AUDIT_ACTIONS.TASK_STATUS_CHANGED,
        metadata: { from: existing.status, to: input.status, projectId: existing.projectId },
      });
      await dispatchWebhooks(tenant.workspaceId, "task.status_changed", { taskId: existing.id, from: existing.status, to: input.status });
    }
    if (input.priority && input.priority !== existing.priority) {
      await recordActivity({
        workspaceId: tenant.workspaceId,
        actorId: tenant.userId,
        entityType: "task",
        entityId: existing.id,
        action: AUDIT_ACTIONS.TASK_UPDATED,
        metadata: { field: "priority", from: existing.priority, to: input.priority, projectId: existing.projectId },
      });
    }
    if (input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId) {
      await recordActivity({
        workspaceId: tenant.workspaceId,
        actorId: tenant.userId,
        entityType: "task",
        entityId: existing.id,
        action: AUDIT_ACTIONS.TASK_ASSIGNED,
        metadata: { assigneeId: input.assigneeId, projectId: existing.projectId },
      });
      await notifyUsers({
        workspaceId: tenant.workspaceId,
        userIds: [input.assigneeId],
        exceptUserId: tenant.userId,
        type: "TASK_ASSIGNED",
        title: "Task assigned to you",
        body: input.title ?? existing.title,
        link: `/app/projects/${existing.projectId}/board?task=${existing.id}`,
        metadata: { taskId: existing.id, projectId: existing.projectId },
      });
    }
    return readTask(tenant, existing.id);
  },

  async move(tenant: TenantContext, taskId: string, input: MoveTaskInput) {
    const existing = await loadTask(tenant, taskId);
    const column = await columnFor(tenant.workspaceId, existing.projectId, input.status);
    const neighbors = await prisma.task.findMany({
      where: activeTaskWhere(tenant.workspaceId, {
        projectId: existing.projectId,
        status: input.status,
        id: { in: [input.beforeTaskId, input.afterTaskId].filter((id): id is string => Boolean(id)) },
      }),
    });
    const before = neighbors.find((task) => task.id === input.beforeTaskId)?.position ?? null;
    const after = neighbors.find((task) => task.id === input.afterTaskId)?.position ?? null;
    await prisma.task.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        boardColumnId: column.id,
        position: positionBetween(before, after),
        completedAt: input.status === "DONE" ? existing.completedAt ?? new Date() : input.status === existing.status ? existing.completedAt : null,
      },
    });
    if (input.status !== existing.status) {
      await recordActivity({
        workspaceId: tenant.workspaceId,
        actorId: tenant.userId,
        entityType: "task",
        entityId: existing.id,
        action: AUDIT_ACTIONS.TASK_STATUS_CHANGED,
        metadata: { from: existing.status, to: input.status, projectId: existing.projectId },
      });
    }
    return readTask(tenant, existing.id);
  },

  async remove(tenant: TenantContext, taskId: string) {
    const task = await loadTask(tenant, taskId);
    await prisma.task.update({
      where: { id: task.id },
      data: { deletedAt: new Date() },
    });
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "task",
      entityId: task.id,
      action: AUDIT_ACTIONS.TASK_DELETED,
      metadata: { title: task.title, projectId: task.projectId },
    });
  },

  async listLabels(tenant: TenantContext) {
    return prisma.taskLabel.findMany({
      where: { workspaceId: tenant.workspaceId },
      orderBy: { name: "asc" },
    });
  },

  async createLabel(tenant: TenantContext, input: CreateLabelInput) {
    return prisma.taskLabel.create({
      data: { workspaceId: tenant.workspaceId, name: input.name.trim(), color: input.color },
    });
  },
};
