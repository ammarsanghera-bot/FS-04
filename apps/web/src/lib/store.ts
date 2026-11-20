import { create } from "zustand";
import type { User, WorkspaceSummary } from "./types";

interface SessionInput {
  accessToken: string;
  user: User;
  workspaces: WorkspaceSummary[];
  workspaceId?: string | null;
}

interface AuthState {
  booted: boolean;
  accessToken: string | null;
  user: User | null;
  workspaces: WorkspaceSummary[];
  workspaceId: string | null;
  setBooted: (booted: boolean) => void;
  setSession: (session: SessionInput) => void;
  setWorkspace: (workspaceId: string) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

const storageKey = "fb-session";

function persist(state: Pick<AuthState, "accessToken" | "user" | "workspaces" | "workspaceId">) {
  sessionStorage.setItem(storageKey, JSON.stringify(state));
}

function read(): Partial<AuthState> {
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Partial<AuthState>) : {};
  } catch {
    return {};
  }
}

const saved = read();

export const useAuth = create<AuthState>((set, get) => ({
  booted: false,
  accessToken: saved.accessToken ?? null,
  user: saved.user ?? null,
  workspaces: saved.workspaces ?? [],
  workspaceId: saved.workspaceId ?? null,
  setBooted: (booted) => set({ booted }),
  setSession: (session) => {
    const workspaceId = session.workspaceId ?? session.workspaces[0]?.id ?? null;
    const next = {
      accessToken: session.accessToken,
      user: session.user,
      workspaces: session.workspaces,
      workspaceId,
    };
    persist(next);
    set(next);
  },
  setWorkspace: (workspaceId) => {
    const next = { ...get(), workspaceId };
    persist(next);
    set({ workspaceId });
  },
  setUser: (user) => {
    const next = { ...get(), user };
    persist({ accessToken: next.accessToken, user, workspaces: next.workspaces, workspaceId: next.workspaceId });
    set({ user });
  },
  clear: () => {
    sessionStorage.removeItem(storageKey);
    set({ accessToken: null, user: null, workspaces: [], workspaceId: null });
  },
}));

export function currentRole() {
  const { workspaces, workspaceId } = useAuth.getState();
  return workspaces.find((workspace) => workspace.id === workspaceId)?.role ?? null;
}
