import { useAuth } from "./store";

const API_URL = import.meta.env.VITE_API_URL || "";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken() {
  const response = await fetch(`${API_URL}/api/v1/auth/refresh`, { method: "POST", credentials: "include" });
  if (!response.ok) return false;
  const data = await response.json();
  useAuth.getState().setSession(data);
  return true;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  const { accessToken, workspaceId } = useAuth.getState();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (workspaceId) headers.set("X-Workspace-Id", workspaceId);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retry && !path.includes("/auth/refresh") && !path.includes("/auth/login")) {
    refreshing ??= refreshAccessToken().finally(() => {
      refreshing = null;
    });
    const ok = await refreshing;
    if (ok) return api<T>(path, init, false);
    useAuth.getState().clear();
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data?.error?.message ?? "Request failed", response.status, data?.error?.details);
  }
  return data as T;
}

export function workspacePath(suffix = "") {
  const id = useAuth.getState().workspaceId;
  if (!id) throw new ApiError("Choose a workspace", 400);
  return `/api/v1/workspaces/${id}${suffix}`;
}
