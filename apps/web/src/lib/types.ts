import type { ProjectStatus, SprintStatus, TaskPriority, TaskStatus, WorkspaceRole } from "@flowboard/shared";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface TaskLabel {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  identifier: string;
  number: number;
  projectId: string;
  projectKey: string;
  projectName?: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assignee: User | null;
  reporter: User;
  startDate: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  labels: TaskLabel[];
  commentCount: number;
  attachmentCount: number;
  sprint: { id: string; name: string; status: SprintStatus } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  key: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  deadline: string | null;
  lead: User | null;
  memberCount: number;
  taskCount: number;
  completedCount: number;
  progress: number;
}

export interface BoardColumn {
  id: string;
  name: string;
  status: TaskStatus;
  position: number;
  tasks: Task[];
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: User;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploadedBy?: { id: string; name: string };
}

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: User | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
