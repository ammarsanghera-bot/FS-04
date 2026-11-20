import { z } from "zod";
import {
  PLAN_TIERS,
  PROJECT_STATUSES,
  SPRINT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  WORKSPACE_ROLES,
} from "./constants.js";

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include a letter")
  .regex(/[0-9]/, "Include a number");

export const dateInputSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");

const optionalDate = dateInputSchema.nullable().optional();

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200),
  password: passwordSchema,
  workspaceName: z.string().trim().min(2).max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens")
    .optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(WORKSPACE_ROLES).refine((role) => role !== "OWNER", "Transfer ownership from the team page"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(WORKSPACE_ROLES),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(20),
});

export const projectKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(6)
  .regex(/^[A-Za-z][A-Za-z0-9]+$/)
  .transform((value) => value.toUpperCase());

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  key: projectKeySchema.optional(),
  description: z.string().trim().max(10000).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  startDate: optionalDate,
  deadline: optionalDate,
  leadId: z.string().uuid().nullable().optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(PROJECT_STATUSES).optional(),
});

export const projectMemberSchema = z.object({
  userId: z.string().uuid(),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(20000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  startDate: optionalDate,
  dueDate: optionalDate,
  estimateHours: z.number().int().min(0).max(1000).nullable().optional(),
  labelIds: z.array(z.string().uuid()).max(12).optional(),
  sprintId: z.string().uuid().nullable().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
  beforeTaskId: z.string().uuid().nullable().optional(),
  afterTaskId: z.string().uuid().nullable().optional(),
});

export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const setLabelsSchema = z.object({
  labelIds: z.array(z.string().uuid()).max(12),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const updateCommentSchema = createCommentSchema;

export const createSprintSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  goal: z.string().trim().max(2000).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
});

export const updateSprintSchema = createSprintSchema.partial().omit({ projectId: true });

export const sprintTaskSchema = z.object({
  taskId: z.string().uuid(),
});

export const checkoutSchema = z.object({
  planTier: z.enum(PLAN_TIERS).refine((tier) => tier !== "FREE", "Choose Pro or Business"),
});

export const mockActivateSchema = z.object({
  planTier: z.enum(PLAN_TIERS),
});

export const cancelSubscriptionSchema = z.object({
  when: z.enum(["period_end", "now"]),
});

export const createWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.string().min(3).max(80)).min(1).max(20),
});

export const taskQuerySchema = z.object({
  search: z.string().max(200).optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  labelId: z.string().uuid().optional(),
  dueBefore: z.string().optional(),
  dueAfter: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  sprintId: z.string().uuid().optional(),
});

export const activityQuerySchema = z.object({
  entityType: z.string().max(40).optional(),
  action: z.string().max(80).optional(),
  actorId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  projectId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type CreateSprintInput = z.infer<typeof createSprintSchema>;
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
