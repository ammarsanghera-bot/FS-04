import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { requirePermission } from "../../middleware/tenant.js";
import * as collaboration from "./collaboration.controller.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_BYTES } });
export const collaborationRouter = Router({ mergeParams: true });

collaborationRouter.get("/tasks/:taskId/comments", requirePermission("workspace:read"), collaboration.listComments);
collaborationRouter.post("/tasks/:taskId/comments", requirePermission("comments:create"), collaboration.addComment);
collaborationRouter.patch("/comments/:commentId", requirePermission("comments:create"), collaboration.updateComment);
collaborationRouter.delete("/comments/:commentId", requirePermission("comments:create"), collaboration.deleteComment);
collaborationRouter.post("/tasks/:taskId/attachments", requirePermission("tasks:update"), upload.single("file"), collaboration.addAttachment);
collaborationRouter.get("/attachments/:attachmentId/download", requirePermission("workspace:read"), collaboration.downloadAttachment);
collaborationRouter.delete("/attachments/:attachmentId", requirePermission("tasks:update"), collaboration.deleteAttachment);
collaborationRouter.get("/notifications", requirePermission("workspace:read"), collaboration.listNotifications);
collaborationRouter.post("/notifications/read-all", requirePermission("workspace:read"), collaboration.markAllRead);
collaborationRouter.post("/notifications/:notificationId/read", requirePermission("workspace:read"), collaboration.markRead);
collaborationRouter.get("/activity", requirePermission("audit:read"), collaboration.listActivity);
