import { PLAN_IDS } from "@flowboard/shared";
import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";
import { billingService } from "../src/modules/billing/billing.service.js";
import { sha256 } from "../src/lib/crypto.js";

const PASSWORD = "Password123!";
const DEMO_INVITE_TOKEN = "demo-invite-token-acme-local-only-0001";

if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO !== "true") {
  console.error("Refusing to seed demo data in production. Set SEED_DEMO=true to override.");
  process.exit(1);
}

await billingService.ensurePlans();
const passwordHash = await hashPassword(PASSWORD);

async function user(email: string, name: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, emailVerifiedAt: new Date() },
    create: { email, name, passwordHash, emailVerifiedAt: new Date() },
  });
}

const ada = await user("owner@acme.flowboard.dev", "Ada Owner");
const sam = await user("admin@acme.flowboard.dev", "Sam Admin");
const priya = await user("manager@acme.flowboard.dev", "Priya Manager");
const leo = await user("member@acme.flowboard.dev", "Leo Member");
const noor = await user("member2@acme.flowboard.dev", "Noor Member");
const owen = await user("outsider@northwind.flowboard.dev", "Owen Outsider");

async function workspace(slug: string, name: string, planId: string) {
  const row = await prisma.workspace.upsert({
    where: { slug },
    update: { name, deletedAt: null },
    create: { slug, name },
  });
  await prisma.subscription.upsert({
    where: { workspaceId: row.id },
    update: { planId, status: "ACTIVE" },
    create: { workspaceId: row.id, planId, status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 30 * 86400000) },
  });
  return row;
}

const acme = await workspace("acme", "Acme Studio", PLAN_IDS.PRO);
const northwind = await workspace("northwind", "Northwind", PLAN_IDS.FREE);

async function member(workspaceId: string, userId: string, role: "OWNER" | "ADMIN" | "MANAGER" | "MEMBER") {
  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    update: { role },
    create: { workspaceId, userId, role },
  });
}

await member(acme.id, ada.id, "OWNER");
await member(acme.id, sam.id, "ADMIN");
await member(acme.id, priya.id, "MANAGER");
await member(acme.id, leo.id, "MEMBER");
await member(acme.id, noor.id, "MEMBER");
await member(northwind.id, owen.id, "OWNER");

const already = await prisma.project.findFirst({ where: { workspaceId: acme.id, key: "WEB" } });
if (already) {
  console.info("Demo workspace already has projects. Accounts were refreshed.");
  console.info("Local development password for every demo account: Password123!");
  await prisma.$disconnect();
  process.exit(0);
}

const labels = await Promise.all(
  [
    ["Bug", "#9f2d2d"],
    ["Feature", "#0f6e56"],
    ["Design", "#9a6b2f"],
    ["Chore", "#57534e"],
  ].map(([name, color]) =>
    prisma.taskLabel.create({ data: { workspaceId: acme.id, name, color } }),
  ),
);
const labelByName = Object.fromEntries(labels.map((label) => [label.name, label]));

async function makeProject(input: {
  key: string;
  name: string;
  description: string;
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  leadId: string;
  memberIds: string[];
  startDate?: Date;
  deadline?: Date;
}) {
  return prisma.project.create({
    data: {
      workspaceId: acme.id,
      key: input.key,
      name: input.name,
      description: input.description,
      status: input.status,
      leadId: input.leadId,
      startDate: input.startDate,
      deadline: input.deadline,
      members: { create: input.memberIds.map((userId) => ({ userId, workspaceId: acme.id })) },
      boards: {
        create: {
          workspaceId: acme.id,
          name: "Board",
          columns: {
            create: [
              { workspaceId: acme.id, name: "Backlog", status: "BACKLOG", position: 0 },
              { workspaceId: acme.id, name: "To Do", status: "TODO", position: 1 },
              { workspaceId: acme.id, name: "In Progress", status: "IN_PROGRESS", position: 2 },
              { workspaceId: acme.id, name: "In Review", status: "IN_REVIEW", position: 3 },
              { workspaceId: acme.id, name: "Done", status: "DONE", position: 4 },
            ],
          },
        },
      },
    },
    include: { boards: { include: { columns: true } } },
  });
}

const people = [ada.id, sam.id, priya.id, leo.id, noor.id];
const web = await makeProject({
  key: "WEB",
  name: "Website Redesign",
  description: "Rebuild the marketing site and the logged-in project home. Keep the launch checklist in this project.",
  status: "ACTIVE",
  leadId: priya.id,
  memberIds: people,
  startDate: new Date("2026-11-02"),
  deadline: new Date("2026-12-18"),
});
const app = await makeProject({
  key: "APP",
  name: "Mobile Checkout",
  description: "Ship the checkout rewrite for iOS and Android, including receipt email and saved cards.",
  status: "ACTIVE",
  leadId: priya.id,
  memberIds: people,
  startDate: new Date("2026-10-20"),
  deadline: new Date("2026-12-05"),
});
await makeProject({
  key: "DS",
  name: "Design System",
  description: "Tokens, form controls, and the board components used by the product team. Members are not on this project.",
  status: "PLANNING",
  leadId: ada.id,
  memberIds: [ada.id, sam.id, priya.id],
  startDate: new Date("2026-11-18"),
});

const northProject = await prisma.project.create({
  data: {
    workspaceId: northwind.id,
    key: "INT",
    name: "Internal",
    description: "Confidential Northwind planning. Acme members must not be able to read this.",
    status: "ACTIVE",
    leadId: owen.id,
    members: { create: { userId: owen.id, workspaceId: northwind.id } },
    boards: {
      create: {
        workspaceId: northwind.id,
        name: "Board",
        columns: { create: { workspaceId: northwind.id, name: "To Do", status: "TODO", position: 1 } },
      },
    },
    tasks: {
      create: {
        workspaceId: northwind.id,
        number: 1,
        title: "Confidential roadmap",
        status: "TODO",
        priority: "HIGH",
        reporterId: owen.id,
        assigneeId: owen.id,
      },
    },
  },
});

const sprint14 = await prisma.sprint.create({
  data: {
    workspaceId: acme.id,
    projectId: web.id,
    name: "Sprint 14",
    goal: "Close the homepage and navigation.",
    status: "COMPLETED",
    startDate: new Date("2026-10-20"),
    endDate: new Date("2026-11-02"),
  },
});
const sprint15 = await prisma.sprint.create({
  data: {
    workspaceId: acme.id,
    projectId: web.id,
    name: "Sprint 15",
    goal: "Ship the project dashboard and board polish.",
    status: "ACTIVE",
    startDate: new Date("2026-11-03"),
    endDate: new Date("2026-11-21"),
  },
});
await prisma.sprint.create({
  data: {
    workspaceId: acme.id,
    projectId: web.id,
    name: "Sprint 16",
    goal: "Pricing page and billing states.",
    status: "PLANNED",
    startDate: new Date("2026-11-24"),
    endDate: new Date("2026-12-05"),
  },
});

const columns = Object.fromEntries(web.boards[0].columns.map((column) => [column.status, column]));
const appColumns = await prisma.boardColumn.findMany({ where: { board: { projectId: app.id } } });
const appColumn = Object.fromEntries(appColumns.map((column) => [column.status, column]));

const now = new Date();
const day = 86400000;
type SeedTask = {
  projectId: string;
  columnId: string;
  number: number;
  title: string;
  description: string;
  status: "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeId: string;
  dueDate?: Date;
  completedAt?: Date;
  labels: string[];
  sprintId?: string;
  comments?: string[];
};

const seeds: SeedTask[] = [
  { projectId: web.id, columnId: columns.DONE.id, number: 1, title: "Audit the current homepage", description: "Note what stays and what is replaced.", status: "DONE", priority: "MEDIUM", assigneeId: leo.id, completedAt: new Date("2026-10-28"), labels: ["Chore"], sprintId: sprint14.id },
  { projectId: web.id, columnId: columns.DONE.id, number: 2, title: "Navigation information architecture", description: "Group marketing and product links.", status: "DONE", priority: "HIGH", assigneeId: priya.id, completedAt: new Date("2026-11-01"), labels: ["Design"], sprintId: sprint14.id },
  { projectId: web.id, columnId: columns.IN_PROGRESS.id, number: 3, title: "Project dashboard layout", description: "Status counts, workload, and the next deadlines.\n\n- Use live API data\n- Keep the overdue count visible", status: "IN_PROGRESS", priority: "HIGH", assigneeId: leo.id, dueDate: new Date(now.getTime() + day), labels: ["Feature"], sprintId: sprint15.id, comments: ["I'll use the report endpoint for the charts.", "Please keep the overdue tile first."] },
  { projectId: web.id, columnId: columns.IN_REVIEW.id, number: 4, title: "Board card density", description: "Show the identifier, priority, assignee, labels, and due date without wrapping the title twice.", status: "IN_REVIEW", priority: "MEDIUM", assigneeId: noor.id, dueDate: new Date(now.getTime() + 2 * day), labels: ["Design"], sprintId: sprint15.id },
  { projectId: web.id, columnId: columns.TODO.id, number: 5, title: "Empty board state", description: "Explain how to create the first task.", status: "TODO", priority: "LOW", assigneeId: leo.id, dueDate: new Date(now.getTime() + 5 * day), labels: ["Feature"], sprintId: sprint15.id },
  { projectId: web.id, columnId: columns.TODO.id, number: 6, title: "Fix overdue badge contrast", description: "The red on sand fails the contrast check.", status: "TODO", priority: "URGENT", assigneeId: sam.id, dueDate: new Date(now.getTime() - day), labels: ["Bug"], sprintId: sprint15.id, comments: ["This is blocking the Friday review."] },
  { projectId: web.id, columnId: columns.BACKLOG.id, number: 7, title: "Customer logo wall", description: "Optional section for the homepage.", status: "BACKLOG", priority: "LOW", assigneeId: noor.id, labels: ["Feature"] },
  { projectId: web.id, columnId: columns.IN_PROGRESS.id, number: 8, title: "Sprint report summary", description: "Total, completed, incomplete, and a status breakdown.", status: "IN_PROGRESS", priority: "HIGH", assigneeId: priya.id, dueDate: new Date(now.getTime() + 3 * day), labels: ["Feature"], sprintId: sprint15.id },
  { projectId: app.id, columnId: appColumn.TODO.id, number: 1, title: "Saved card list", description: "Show the last four digits and the card brand.", status: "TODO", priority: "HIGH", assigneeId: leo.id, dueDate: new Date(now.getTime() + 4 * day), labels: ["Feature"] },
  { projectId: app.id, columnId: appColumn.IN_PROGRESS.id, number: 2, title: "Receipt email copy", description: "Short subject and a plain-text body.", status: "IN_PROGRESS", priority: "MEDIUM", assigneeId: noor.id, dueDate: new Date(now.getTime() + day), labels: ["Chore"] },
  { projectId: app.id, columnId: appColumn.BACKLOG.id, number: 3, title: "Apple Pay spike", description: "Confirm the merchant id before committing.", status: "BACKLOG", priority: "MEDIUM", assigneeId: priya.id, labels: ["Feature"] },
  { projectId: app.id, columnId: appColumn.DONE.id, number: 4, title: "Checkout error states", description: "Map declined and expired cards.", status: "DONE", priority: "HIGH", assigneeId: sam.id, completedAt: new Date(now.getTime() - 2 * day), labels: ["Bug"] },
];

for (const seed of seeds) {
  const task = await prisma.task.create({
    data: {
      workspaceId: acme.id,
      projectId: seed.projectId,
      boardColumnId: seed.columnId,
      number: seed.number,
      title: seed.title,
      description: seed.description,
      status: seed.status,
      priority: seed.priority,
      position: seed.number * 1024,
      assigneeId: seed.assigneeId,
      reporterId: priya.id,
      dueDate: seed.dueDate,
      completedAt: seed.completedAt,
      estimateHours: 4,
    },
  });
  if (seed.labels.length) {
    await prisma.taskLabelAssignment.createMany({
      data: seed.labels.map((name) => ({ taskId: task.id, labelId: labelByName[name].id, workspaceId: acme.id })),
    });
  }
  if (seed.sprintId) {
    await prisma.sprintTask.create({ data: { sprintId: seed.sprintId, taskId: task.id, workspaceId: acme.id } });
  }
  for (const body of seed.comments ?? []) {
    await prisma.comment.create({ data: { workspaceId: acme.id, taskId: task.id, authorId: leo.id, body } });
  }
  await prisma.activityLog.create({
    data: {
      workspaceId: acme.id,
      actorId: priya.id,
      entityType: "task",
      entityId: task.id,
      action: "task.created",
      metadata: { title: task.title, projectId: seed.projectId },
    },
  });
}

await prisma.activityLog.createMany({
  data: [
    { workspaceId: acme.id, actorId: ada.id, entityType: "workspace", entityId: acme.id, action: "workspace.created", metadata: { name: acme.name } },
    { workspaceId: acme.id, actorId: ada.id, entityType: "project", entityId: web.id, action: "project.created", metadata: { name: "Website Redesign", projectId: web.id } },
    { workspaceId: acme.id, actorId: priya.id, entityType: "sprint", entityId: sprint15.id, action: "sprint.started", metadata: { name: "Sprint 15", projectId: web.id } },
    { workspaceId: acme.id, actorId: sam.id, entityType: "member", entityId: leo.id, action: "member.role_changed", metadata: { from: "MANAGER", to: "MEMBER" } },
  ],
});

await prisma.notification.createMany({
  data: [
    { workspaceId: acme.id, userId: leo.id, type: "TASK_ASSIGNED", title: "Task assigned to you", body: "WEB-3 Project dashboard layout", link: `/app/projects/${web.id}/board` },
    { workspaceId: acme.id, userId: leo.id, type: "COMMENT", title: "New comment", body: "Please keep the overdue tile first.", link: `/app/projects/${web.id}/board` },
    { workspaceId: acme.id, userId: sam.id, type: "DEADLINE_APPROACHING", title: "Deadline approaching", body: "WEB-6 is overdue.", link: `/app/projects/${web.id}/board` },
  ],
});

await prisma.invitation.upsert({
  where: { tokenHash: sha256(DEMO_INVITE_TOKEN) },
  update: {},
  create: {
    workspaceId: acme.id,
    email: "invited@acme.flowboard.dev",
    role: "MEMBER",
    tokenHash: sha256(DEMO_INVITE_TOKEN),
    invitedById: ada.id,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  },
});

console.info("Seeded Acme Studio and Northwind.");
console.info("Local development only. Password for every demo account: Password123!");
console.info("Owner   owner@acme.flowboard.dev");
console.info("Admin   admin@acme.flowboard.dev");
console.info("Manager manager@acme.flowboard.dev");
console.info("Member  member@acme.flowboard.dev");
console.info("Member  member2@acme.flowboard.dev");
console.info("Other tenant  outsider@northwind.flowboard.dev");
console.info(`Pending invite token (local only): ${DEMO_INVITE_TOKEN}`);
console.info(`Northwind project id: ${northProject.id}`);
void PLAN_IDS;

await prisma.$disconnect();
