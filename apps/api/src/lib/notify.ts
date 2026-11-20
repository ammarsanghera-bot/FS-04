import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export async function notifyUsers(input: {
  workspaceId: string;
  userIds: Array<string | null | undefined>;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Prisma.InputJsonValue;
  exceptUserId?: string;
}) {
  const ids = [...new Set(input.userIds.filter((id): id is string => Boolean(id && id !== input.exceptUserId)))];
  if (ids.length === 0) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      workspaceId: input.workspaceId,
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      metadata: input.metadata,
    })),
  });
}
