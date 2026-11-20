export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "MANAGER", "MEMBER"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const SPRINT_STATUSES = ["PLANNED", "ACTIVE", "COMPLETED"] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

export const PLAN_TIERS = ["FREE", "PRO", "BUSINESS"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "TASK_ASSIGNED",
  "MENTION",
  "COMMENT",
  "PROJECT_INVITATION",
  "SPRINT_STARTED",
  "DEADLINE_APPROACHING",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const DEFAULT_COLUMNS: { name: string; status: TaskStatus; position: number }[] = [
  { name: "Backlog", status: "BACKLOG", position: 0 },
  { name: "To Do", status: "TODO", position: 1 },
  { name: "In Progress", status: "IN_PROGRESS", position: 2 },
  { name: "In Review", status: "IN_REVIEW", position: 3 },
  { name: "Done", status: "DONE", position: 4 },
];

export const PLAN_IDS: Record<PlanTier, string> = {
  FREE: "00000000-0000-4000-8000-000000000001",
  PRO: "00000000-0000-4000-8000-000000000002",
  BUSINESS: "00000000-0000-4000-8000-000000000003",
};

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  description: string;
  maxProjects: number | null;
  maxMembers: number | null;
  maxTasks: number | null;
  advancedReports: boolean;
  prioritySupport: boolean;
  customIntegrations: boolean;
  monthlyPriceCents: number;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    tier: "FREE",
    name: "Free",
    description: "For a small team trying Flowboard with a real workspace.",
    maxProjects: 3,
    maxMembers: 5,
    maxTasks: 100,
    advancedReports: false,
    prioritySupport: false,
    customIntegrations: false,
    monthlyPriceCents: 0,
  },
  {
    tier: "PRO",
    name: "Pro",
    description: "Unlimited projects, a larger team, and advanced reports.",
    maxProjects: null,
    maxMembers: 25,
    maxTasks: null,
    advancedReports: true,
    prioritySupport: false,
    customIntegrations: false,
    monthlyPriceCents: 1900,
  },
  {
    tier: "BUSINESS",
    name: "Business",
    description: "Unlimited scale, priority support, and custom integrations.",
    maxProjects: null,
    maxMembers: null,
    maxTasks: null,
    advancedReports: true,
    prioritySupport: true,
    customIntegrations: true,
    monthlyPriceCents: 4900,
  },
];

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const AUDIT_ACTIONS = {
  WORKSPACE_CREATED: "workspace.created",
  MEMBER_INVITED: "member.invited",
  MEMBER_ROLE_CHANGED: "member.role_changed",
  MEMBER_REMOVED: "member.removed",
  PROJECT_CREATED: "project.created",
  PROJECT_UPDATED: "project.updated",
  PROJECT_ARCHIVED: "project.archived",
  PROJECT_DELETED: "project.deleted",
  TASK_CREATED: "task.created",
  TASK_UPDATED: "task.updated",
  TASK_STATUS_CHANGED: "task.status_changed",
  TASK_ASSIGNED: "task.assigned",
  TASK_DELETED: "task.deleted",
  COMMENT_ADDED: "comment.added",
  ATTACHMENT_UPLOADED: "attachment.uploaded",
  SPRINT_CREATED: "sprint.created",
  SPRINT_STARTED: "sprint.started",
  SPRINT_COMPLETED: "sprint.completed",
  BILLING_PLAN_CHANGED: "billing.plan_changed",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  MEMBER: "Member",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export function taskIdentifier(projectKey: string, number: number) {
  return `${projectKey}-${number}`;
}

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
