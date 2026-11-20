import { activityQuerySchema, createCommentSchema, updateCommentSchema } from "@flowboard/shared";
import { parseOrThrow } from "../../lib/errors.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireTenant } from "../../middleware/tenant.js";
import { collaborationService } from "./collaboration.service.js";

export const listComments = asyncHandler(async (req, res) => {
  res.json({ comments: await collaborationService.listComments(requireTenant(req), String(req.params.taskId)) });
});

export const addComment = asyncHandler(async (req, res) => {
  const comment = await collaborationService.addComment(requireTenant(req), String(req.params.taskId), parseOrThrow(createCommentSchema, req.body));
  res.status(201).json({ comment });
});

export const updateComment = asyncHandler(async (req, res) => {
  const body = parseOrThrow(updateCommentSchema, req.body);
  res.json({ comment: await collaborationService.updateComment(requireTenant(req), String(req.params.commentId), body.body) });
});

export const deleteComment = asyncHandler(async (req, res) => {
  await collaborationService.deleteComment(requireTenant(req), String(req.params.commentId));
  res.status(204).end();
});

export const addAttachment = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Choose a file" } });
    return;
  }
  res.status(201).json({ attachment: await collaborationService.addAttachment(requireTenant(req), String(req.params.taskId), req.file) });
});

export const downloadAttachment = asyncHandler(async (req, res) => {
  const { attachment, stream } = await collaborationService.openAttachment(requireTenant(req), String(req.params.attachmentId));
  res.setHeader("Content-Type", attachment.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`);
  stream.pipe(res);
});

export const deleteAttachment = asyncHandler(async (req, res) => {
  await collaborationService.deleteAttachment(requireTenant(req), String(req.params.attachmentId));
  res.status(204).end();
});

export const listNotifications = asyncHandler(async (req, res) => {
  res.json(await collaborationService.listNotifications(requireTenant(req)));
});

export const markRead = asyncHandler(async (req, res) => {
  await collaborationService.markRead(requireTenant(req), String(req.params.notificationId));
  res.status(204).end();
});

export const markAllRead = asyncHandler(async (req, res) => {
  await collaborationService.markAllRead(requireTenant(req));
  res.status(204).end();
});

export const listActivity = asyncHandler(async (req, res) => {
  res.json(await collaborationService.listActivity(requireTenant(req), parseOrThrow(activityQuerySchema, req.query)));
});
