import { PLAN_DEFINITIONS, type PlanTier } from "@flowboard/shared";
import { Errors } from "./errors.js";
import { prisma } from "./prisma.js";

export async function getWorkspaceSubscription(workspaceId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { workspaceId },
    include: { plan: true },
  });
  if (!subscription) throw Errors.notFound("Subscription not found");
  return subscription;
}

export async function assertCanAdd(workspaceId: string, resource: "projects" | "members" | "tasks") {
  const subscription = await getWorkspaceSubscription(workspaceId);
  const plan = subscription.plan;
  if (resource === "projects" && plan.maxProjects != null) {
    const count = await prisma.project.count({
      where: { workspaceId, deletedAt: null, status: { not: "ARCHIVED" } },
    });
    if (count >= plan.maxProjects) {
      throw Errors.planLimit(`The ${plan.name} plan includes ${plan.maxProjects} active projects.`);
    }
  }
  if (resource === "members" && plan.maxMembers != null) {
    const [members, pending] = await Promise.all([
      prisma.workspaceMember.count({ where: { workspaceId } }),
      prisma.invitation.count({ where: { workspaceId, status: "PENDING", expiresAt: { gt: new Date() } } }),
    ]);
    if (members + pending >= plan.maxMembers) {
      throw Errors.planLimit(`The ${plan.name} plan includes ${plan.maxMembers} members.`);
    }
  }
  if (resource === "tasks" && plan.maxTasks != null) {
    const count = await prisma.task.count({ where: { workspaceId, deletedAt: null } });
    if (count >= plan.maxTasks) {
      throw Errors.planLimit(`The ${plan.name} plan includes ${plan.maxTasks} tasks.`);
    }
  }
  return subscription;
}

export async function assertPlanFitsUsage(workspaceId: string, tier: PlanTier) {
  const definition = PLAN_DEFINITIONS.find((plan) => plan.tier === tier);
  if (!definition) throw Errors.badRequest("Unknown plan");
  const [projects, members, tasks] = await Promise.all([
    prisma.project.count({ where: { workspaceId, deletedAt: null, status: { not: "ARCHIVED" } } }),
    prisma.workspaceMember.count({ where: { workspaceId } }),
    prisma.task.count({ where: { workspaceId, deletedAt: null } }),
  ]);
  if (definition.maxProjects != null && projects > definition.maxProjects) {
    throw Errors.planLimit(`Archive projects until you have ${definition.maxProjects} or fewer before moving to ${definition.name}.`);
  }
  if (definition.maxMembers != null && members > definition.maxMembers) {
    throw Errors.planLimit(`Remove members until you have ${definition.maxMembers} or fewer before moving to ${definition.name}.`);
  }
  if (definition.maxTasks != null && tasks > definition.maxTasks) {
    throw Errors.planLimit(`This workspace has more tasks than the ${definition.name} plan allows.`);
  }
}
