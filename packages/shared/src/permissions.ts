import { WORKSPACE_ROLES, type WorkspaceRole } from "./constants.js";

export const PERMISSIONS = {
  "workspace:read": WORKSPACE_ROLES,
  "workspace:update": ["OWNER", "ADMIN"],
  "workspace:delete": ["OWNER"],
  "billing:manage": ["OWNER"],
  "members:read": WORKSPACE_ROLES,
  "members:manage": ["OWNER", "ADMIN"],
  "projects:create": ["OWNER", "ADMIN", "MANAGER"],
  "projects:update": ["OWNER", "ADMIN", "MANAGER"],
  "projects:delete": ["OWNER", "ADMIN"],
  "projects:read_all": ["OWNER", "ADMIN", "MANAGER"],
  "tasks:create": WORKSPACE_ROLES,
  "tasks:update": WORKSPACE_ROLES,
  "tasks:delete": ["OWNER", "ADMIN", "MANAGER"],
  "sprints:manage": ["OWNER", "ADMIN", "MANAGER"],
  "comments:create": WORKSPACE_ROLES,
  "comments:delete_any": ["OWNER", "ADMIN"],
  "reports:view": WORKSPACE_ROLES,
  "audit:read": ["OWNER", "ADMIN"],
  "webhooks:manage": ["OWNER", "ADMIN"],
  "attachments:delete_any": ["OWNER", "ADMIN"],
} as const satisfies Record<string, readonly WorkspaceRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: WorkspaceRole, permission: Permission) {
  return (PERMISSIONS[permission] as readonly WorkspaceRole[]).includes(role);
}

export function canManageRole(actor: WorkspaceRole, target: WorkspaceRole) {
  if (actor === "OWNER") return true;
  if (actor === "ADMIN") return target === "ADMIN" || target === "MANAGER" || target === "MEMBER";
  return false;
}
