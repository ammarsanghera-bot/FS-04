import request from "supertest";
import { prisma } from "../src/lib/prisma.js";
import { createApp } from "../src/app.js";
import { billingService } from "../src/modules/billing/billing.service.js";

export const app = createApp();

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "WebhookEvent", "Webhook", "Notification", "ActivityLog", "Attachment", "Comment",
      "SprintTask", "Sprint", "TaskLabelAssignment", "Task", "BoardColumn", "Board",
      "ProjectMember", "Project", "Invitation", "Subscription", "WorkspaceMember", "Workspace",
      "RefreshToken", "PasswordResetToken", "EmailVerificationToken", "TaskLabel", "User", "Plan"
    RESTART IDENTITY CASCADE
  `);
  await billingService.ensurePlans();
}

export async function register(email: string, workspaceName: string) {
  const response = await request(app).post("/api/v1/auth/register").send({
    name: "Test User",
    email,
    password: "Password123!",
    workspaceName,
  });
  return response;
}
