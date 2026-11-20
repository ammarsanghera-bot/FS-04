import type { Prisma } from "@prisma/client";
import { taskIdentifier } from "@flowboard/shared";

export const userSelect = {
  id: true,
  email: true,
  name: true,
  avatarKey: true,
  emailVerifiedAt: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export function presentUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarKey ? `/api/v1/auth/avatars/${user.id}` : null,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

export const taskInclude = {
  assignee: { select: userSelect },
  reporter: { select: userSelect },
  project: { select: { id: true, key: true, name: true } },
  labels: { include: { label: true } },
  sprintTasks: {
    include: { sprint: { select: { id: true, name: true, status: true } } },
    take: 1,
  },
  _count: {
    select: {
      comments: { where: { deletedAt: null } },
      attachments: true,
    },
  },
} satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function presentTask(task: TaskRow) {
  const sprint = task.sprintTasks[0]?.sprint ?? null;
  return {
    id: task.id,
    identifier: taskIdentifier(task.project.key, task.number),
    number: task.number,
    projectId: task.projectId,
    projectKey: task.project.key,
    projectName: task.project.name,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    position: task.position,
    assignee: task.assignee ? presentUser(task.assignee) : null,
    reporter: presentUser(task.reporter),
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimateHours: task.estimateHours,
    completedAt: task.completedAt,
    labels: task.labels.map((item) => ({ id: item.label.id, name: item.label.name, color: item.label.color })),
    commentCount: task._count.comments,
    attachmentCount: task._count.attachments,
    sprint,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
