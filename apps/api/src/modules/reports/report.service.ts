import { hasPermission } from "@flowboard/shared";
import type { ReportQuery } from "@flowboard/shared";
import { getWorkspaceSubscription } from "../../lib/limits.js";
import { presentUser, userSelect } from "../../lib/presenters.js";
import { prisma } from "../../lib/prisma.js";
import type { TenantContext } from "../../lib/access.js";

function range(query: ReportQuery) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 86400000);
  return { from, to };
}

export const reportService = {
  async dashboard(tenant: TenantContext, query: ReportQuery) {
    const { from, to } = range(query);
    const subscription = await getWorkspaceSubscription(tenant.workspaceId);
    const memberOnly = !hasPermission(tenant.role, "projects:read_all");
    const projectWhere = {
      workspaceId: tenant.workspaceId,
      deletedAt: null,
      ...(memberOnly ? { members: { some: { userId: tenant.userId } } } : {}),
    };
    const projects = await prisma.project.findMany({ where: projectWhere, select: { id: true, name: true, status: true } });
    const projectIds = projects.map((project) => project.id);
    const taskWhere = { workspaceId: tenant.workspaceId, deletedAt: null, projectId: { in: projectIds } };
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const [tasks, assignedToMe, completedThisWeek, overdue, upcoming] = await Promise.all([
      prisma.task.findMany({
        where: taskWhere,
        select: { status: true, priority: true, assigneeId: true, completedAt: true, dueDate: true, projectId: true, updatedAt: true },
      }),
      prisma.task.count({ where: { ...taskWhere, assigneeId: tenant.userId, status: { not: "DONE" } } }),
      prisma.task.count({ where: { ...taskWhere, status: "DONE", completedAt: { gte: weekStart, lte: to } } }),
      prisma.task.count({ where: { ...taskWhere, status: { not: "DONE" }, dueDate: { lt: now } } }),
      prisma.task.findMany({
        where: { ...taskWhere, status: { not: "DONE" }, dueDate: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } },
        orderBy: { dueDate: "asc" },
        take: 8,
        include: { project: { select: { key: true } }, assignee: { select: userSelect } },
      }),
    ]);
    const statusDistribution = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].map((status) => ({
      status,
      count: tasks.filter((task) => task.status === status).length,
    }));
    const completed = tasks.filter((task) => task.status === "DONE").length;
    const basic = {
      totals: {
        projects: projects.length,
        activeProjects: projects.filter((project) => project.status === "ACTIVE").length,
        tasks: tasks.length,
        completedTasks: completed,
        overdueTasks: overdue,
        assignedToMe,
        completedThisWeek,
        upcomingDeadlines: upcoming.length,
      },
      upcoming: upcoming.map((task) => ({
        id: task.id,
        identifier: `${task.project.key}-${task.number}`,
        title: task.title,
        dueDate: task.dueDate,
        priority: task.priority,
        assignee: task.assignee ? presentUser(task.assignee) : null,
        projectId: task.projectId,
      })),
      statusDistribution,
      from,
      to,
      advanced: subscription.plan.advancedReports,
    };
    if (!subscription.plan.advancedReports) {
      return { ...basic, completionOverTime: [], projectProgress: [], workload: [], priorityDistribution: [], locked: true };
    }
    const days: { date: string; count: number }[] = [];
    for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      days.push({
        date: key,
        count: tasks.filter((task) => task.completedAt && task.completedAt.toISOString().slice(0, 10) === key).length,
      });
    }
    const projectProgress = projects.map((project) => {
      const related = tasks.filter((task) => task.projectId === project.id);
      const done = related.filter((task) => task.status === "DONE").length;
      return {
        projectId: project.id,
        name: project.name,
        total: related.length,
        completed: done,
        percent: related.length === 0 ? 0 : Math.round((done / related.length) * 100),
      };
    });
    const assignees = await prisma.user.findMany({
      where: { memberships: { some: { workspaceId: tenant.workspaceId } } },
      select: userSelect,
    });
    const workload = assignees.map((user) => ({
      userId: user.id,
      name: user.name,
      open: tasks.filter((task) => task.assigneeId === user.id && task.status !== "DONE").length,
      done: tasks.filter((task) => task.assigneeId === user.id && task.status === "DONE").length,
    }));
    const priorityDistribution = ["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => ({
      priority,
      count: tasks.filter((task) => task.priority === priority).length,
    }));
    return { ...basic, completionOverTime: days, projectProgress, workload, priorityDistribution, locked: false };
  },
};
