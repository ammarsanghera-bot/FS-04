import { Prisma } from "@prisma/client";

/** Forces tenant-owned reads and writes onto one verified workspace id. */
export function scopedWhere<T extends Record<string, unknown>>(workspaceId: string, where: T = {} as T) {
  const { workspaceId: _ignored, ...rest } = where;
  return { ...rest, workspaceId };
}

export function activeProjectWhere(workspaceId: string, where: Prisma.ProjectWhereInput = {}): Prisma.ProjectWhereInput {
  return { AND: [{ workspaceId, deletedAt: null }, where] };
}

export function activeTaskWhere(workspaceId: string, where: Prisma.TaskWhereInput = {}): Prisma.TaskWhereInput {
  return { AND: [{ workspaceId, deletedAt: null }, where] };
}
