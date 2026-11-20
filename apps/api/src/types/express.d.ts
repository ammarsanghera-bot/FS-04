import type { WorkspaceRole } from "@flowboard/shared";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; name: string };
      tenant?: {
        workspaceId: string;
        userId: string;
        role: WorkspaceRole;
        memberId: string;
      };
    }
  }
}

export {};
