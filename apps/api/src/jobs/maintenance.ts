import { notifyUsers } from "../lib/notify.js";
import { prisma } from "../lib/prisma.js";

export async function scanDeadlines() {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { not: "DONE" },
      dueDate: { gte: now, lte: soon },
      assigneeId: { not: null },
    },
    include: { project: { select: { key: true } } },
    take: 200,
  });
  for (const task of tasks) {
    const already = await prisma.notification.findFirst({
      where: {
        userId: task.assigneeId ?? undefined,
        type: "DEADLINE_APPROACHING",
        createdAt: { gte: new Date(now.getTime() - 20 * 60 * 60 * 1000) },
        metadata: { path: ["taskId"], equals: task.id },
      },
    });
    if (already) continue;
    await notifyUsers({
      workspaceId: task.workspaceId,
      userIds: [task.assigneeId, task.reporterId],
      type: "DEADLINE_APPROACHING",
      title: "Deadline approaching",
      body: `${task.project.key}-${task.number} ${task.title} is due within 24 hours.`,
      link: `/app/projects/${task.projectId}/board?task=${task.id}`,
      metadata: { taskId: task.id, projectId: task.projectId },
    });
  }
}
