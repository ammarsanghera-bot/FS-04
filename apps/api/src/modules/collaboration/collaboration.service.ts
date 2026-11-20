import { ALLOWED_ATTACHMENT_MIME_TYPES, AUDIT_ACTIONS, hasPermission } from "@flowboard/shared";
import type { ActivityQuery, CreateCommentInput } from "@flowboard/shared";
import type { Prisma } from "@prisma/client";
import { loadTask, type TenantContext } from "../../lib/access.js";
import { recordActivity } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { notifyUsers } from "../../lib/notify.js";
import { presentUser, userSelect } from "../../lib/presenters.js";
import { prisma } from "../../lib/prisma.js";
import { storage } from "../../lib/storage.js";

async function mentionedUserIds(workspaceId: string, body: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  const lower = body.toLowerCase();
  return members
    .filter((member) => {
      const first = member.user.name.split(/\s+/)[0] ?? "";
      return lower.includes(`@${member.user.email.toLowerCase()}`) || (first.length >= 2 && body.includes(`@${first}`));
    })
    .map((member) => member.user.id);
}

export const collaborationService = {
  async listComments(tenant: TenantContext, taskId: string) {
    await loadTask(tenant, taskId);
    const comments = await prisma.comment.findMany({
      where: { workspaceId: tenant.workspaceId, taskId, deletedAt: null },
      include: { author: { select: userSelect } },
      orderBy: { createdAt: "asc" },
    });
    return comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: presentUser(comment.author),
    }));
  },

  async addComment(tenant: TenantContext, taskId: string, input: CreateCommentInput) {
    const task = await loadTask(tenant, taskId);
    const comment = await prisma.comment.create({
      data: { workspaceId: tenant.workspaceId, taskId, authorId: tenant.userId, body: input.body },
      include: { author: { select: userSelect } },
    });
    const mentions = await mentionedUserIds(tenant.workspaceId, input.body);
    const previous = await prisma.comment.findMany({
      where: { taskId, workspaceId: tenant.workspaceId, deletedAt: null },
      select: { authorId: true },
    });
    const followers = [task.assigneeId, task.reporterId, ...previous.map((item) => item.authorId)];
    await notifyUsers({
      workspaceId: tenant.workspaceId,
      userIds: mentions,
      exceptUserId: tenant.userId,
      type: "MENTION",
      title: "You were mentioned",
      body: input.body.slice(0, 180),
      link: `/app/projects/${task.projectId}/board?task=${task.id}`,
      metadata: { taskId, commentId: comment.id },
    });
    await notifyUsers({
      workspaceId: tenant.workspaceId,
      userIds: followers.filter((id) => !mentions.includes(id ?? "")),
      exceptUserId: tenant.userId,
      type: "COMMENT",
      title: "New comment",
      body: input.body.slice(0, 180),
      link: `/app/projects/${task.projectId}/board?task=${task.id}`,
      metadata: { taskId, commentId: comment.id, projectId: task.projectId },
    });
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "task",
      entityId: task.id,
      action: AUDIT_ACTIONS.COMMENT_ADDED,
      metadata: { commentId: comment.id, projectId: task.projectId },
    });
    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: presentUser(comment.author),
    };
  },

  async updateComment(tenant: TenantContext, commentId: string, body: string) {
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, workspaceId: tenant.workspaceId, deletedAt: null },
    });
    if (!comment) throw Errors.notFound("Comment not found");
    await loadTask(tenant, comment.taskId);
    if (comment.authorId !== tenant.userId) throw Errors.forbidden("You can only edit your own comments");
    return prisma.comment.update({ where: { id: comment.id }, data: { body } });
  },

  async deleteComment(tenant: TenantContext, commentId: string) {
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, workspaceId: tenant.workspaceId, deletedAt: null },
    });
    if (!comment) throw Errors.notFound("Comment not found");
    await loadTask(tenant, comment.taskId);
    const own = comment.authorId === tenant.userId;
    if (!own && !hasPermission(tenant.role, "comments:delete_any")) throw Errors.forbidden();
    await prisma.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } });
  },

  async addAttachment(tenant: TenantContext, taskId: string, file: Express.Multer.File) {
    const task = await loadTask(tenant, taskId);
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number])) {
      throw Errors.badRequest("This file type is not allowed");
    }
    if (file.size > 10 * 1024 * 1024) throw Errors.badRequest("File exceeds the 10 MB limit");
    const stored = await storage.save({
      folder: `workspaces/${tenant.workspaceId}/tasks/${taskId}`,
      originalName: file.originalname,
      bytes: file.buffer,
    });
    const attachment = await prisma.attachment.create({
      data: {
        workspaceId: tenant.workspaceId,
        taskId,
        uploadedById: tenant.userId,
        fileName: file.originalname.slice(0, 200),
        mimeType: file.mimetype,
        size: stored.size,
        storageKey: stored.storageKey,
      },
    });
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "task",
      entityId: task.id,
      action: AUDIT_ACTIONS.ATTACHMENT_UPLOADED,
      metadata: { attachmentId: attachment.id, fileName: attachment.fileName, projectId: task.projectId },
    });
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt,
    };
  },

  async openAttachment(tenant: TenantContext, attachmentId: string) {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, workspaceId: tenant.workspaceId },
    });
    if (!attachment) throw Errors.notFound("Attachment not found");
    await loadTask(tenant, attachment.taskId);
    return { attachment, stream: await storage.open(attachment.storageKey) };
  },

  async deleteAttachment(tenant: TenantContext, attachmentId: string) {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, workspaceId: tenant.workspaceId },
    });
    if (!attachment) throw Errors.notFound("Attachment not found");
    await loadTask(tenant, attachment.taskId);
    const own = attachment.uploadedById === tenant.userId;
    if (!own && !hasPermission(tenant.role, "attachments:delete_any")) throw Errors.forbidden();
    await prisma.attachment.delete({ where: { id: attachment.id } });
    await storage.remove(attachment.storageKey).catch(() => undefined);
  },

  async listNotifications(tenant: TenantContext) {
    const notifications = await prisma.notification.findMany({
      where: { workspaceId: tenant.workspaceId, userId: tenant.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unread = notifications.filter((item) => !item.readAt).length;
    return { notifications, unread };
  },

  async markRead(tenant: TenantContext, notificationId: string) {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, workspaceId: tenant.workspaceId, userId: tenant.userId },
      data: { readAt: new Date() },
    });
    if (result.count === 0) throw Errors.notFound("Notification not found");
  },

  async markAllRead(tenant: TenantContext) {
    await prisma.notification.updateMany({
      where: { workspaceId: tenant.workspaceId, userId: tenant.userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  async listActivity(tenant: TenantContext, query: ActivityQuery) {
    const where: Prisma.ActivityLogWhereInput = {
      workspaceId: tenant.workspaceId,
      entityType: query.entityType,
      action: query.action,
      actorId: query.actorId,
      createdAt:
        query.from || query.to
          ? { gte: query.from ? new Date(query.from) : undefined, lte: query.to ? new Date(query.to) : undefined }
          : undefined,
      ...(query.projectId
        ? {
            OR: [
              { entityType: "project", entityId: query.projectId },
              { metadata: { path: ["projectId"], equals: query.projectId } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        include: { actor: { select: userSelect } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: item.metadata,
        createdAt: item.createdAt,
        actor: item.actor ? presentUser(item.actor) : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  },
};
