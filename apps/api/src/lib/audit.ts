import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export async function recordActivity(input: {
  workspaceId: string;
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.activityLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      metadata: input.metadata,
    },
  });
}
