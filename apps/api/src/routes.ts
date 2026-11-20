import { Router } from "express";
import { prisma } from "./lib/prisma.js";
import { asyncHandler } from "./middleware/async-handler.js";
import { listPlans } from "./modules/billing/billing.controller.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { collaborationRouter } from "./modules/collaboration/collaboration.routes.js";
import { projectRouter } from "./modules/projects/project.routes.js";
import { billingRouter } from "./modules/billing/billing.routes.js";
import { reportRouter } from "./modules/reports/report.routes.js";
import { sprintRouter } from "./modules/sprints/sprint.routes.js";
import { taskRouter } from "./modules/tasks/task.routes.js";
import { webhookRouter } from "./modules/webhooks/webhook.routes.js";
import { invitationRouter, workspaceRouter, workspaceScoped } from "./modules/workspaces/workspace.routes.js";

workspaceScoped.use("/projects", projectRouter);
workspaceScoped.use("/sprints", sprintRouter);
workspaceScoped.use("/billing", billingRouter);
workspaceScoped.use("/reports", reportRouter);
workspaceScoped.use("/webhooks", webhookRouter);
workspaceScoped.use(taskRouter);
workspaceScoped.use(collaborationRouter);

export const apiRouter = Router();

apiRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  }),
);
apiRouter.get("/plans", listPlans);
apiRouter.use("/auth", authRouter);
apiRouter.use("/invitations", invitationRouter);
apiRouter.use("/workspaces", workspaceRouter);
