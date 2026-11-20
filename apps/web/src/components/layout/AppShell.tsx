import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@flowboard/shared";
import { Bell, CreditCard, FolderKanban, LayoutDashboard, LogOut, ScrollText, Settings, Timer, Users } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api, workspacePath } from "@/lib/api";
import { useAuth } from "@/lib/store";
import type { NotificationItem, WorkspaceSummary } from "@/lib/types";
import { cn, initials } from "@/lib/utils";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";

const links = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/projects", label: "Projects", icon: FolderKanban },
  { to: "/app/sprints", label: "Sprints", icon: Timer },
  { to: "/app/team", label: "Team", icon: Users },
  { to: "/app/activity", label: "Activity", icon: ScrollText },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, workspaces, workspaceId, setWorkspace, clear } = useAuth();
  const current = workspaces.find((workspace) => workspace.id === workspaceId);
  const notifications = useQuery({
    queryKey: ["notifications", workspaceId],
    enabled: Boolean(workspaceId),
    refetchInterval: 30000,
    queryFn: () => api<{ notifications: NotificationItem[]; unread: number }>(workspacePath("/notifications")),
  });

  async function switchWorkspace(workspace: WorkspaceSummary) {
    const previous = workspaceId;
    setWorkspace(workspace.id);
    try {
      await api(`/api/v1/workspaces/${workspace.id}/switch`, { method: "POST" });
      await queryClient.invalidateQueries();
      navigate("/app");
    } catch {
      if (previous) setWorkspace(previous);
    }
  }

  async function logout() {
    await api("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    clear();
    navigate("/login");
  }

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="flex flex-col bg-sidebar px-3 py-4 text-stone-200">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="grid grid-cols-2 gap-0.5">
            <i className="h-2.5 w-2.5 rounded-sm bg-emerald-300" />
            <i className="h-2.5 w-2.5 rounded-sm bg-amber-200" />
            <i className="h-2.5 w-2.5 rounded-sm bg-stone-400" />
            <i className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
          </span>
          <span className="font-display text-lg font-semibold text-white">Flowboard</span>
        </div>
        <Menu>
          <MenuTrigger className="mb-4 rounded-xl border border-white/10 px-3 py-2 text-left">
            <div className="text-[11px] uppercase tracking-wide text-stone-400">Workspace</div>
            <div className="truncate text-sm font-semibold text-white">{current?.name ?? "Select"}</div>
          </MenuTrigger>
          <MenuContent>
            {workspaces.map((workspace) => (
              <MenuItem key={workspace.id} onSelect={() => void switchWorkspace(workspace)}>
                {workspace.name} · {workspace.role}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        <nav className="flex flex-1 flex-col gap-1">
          {links.filter((link) => link.to !== "/app/activity" || (current && hasPermission(current.role, "audit:read"))).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm", isActive ? "bg-white/10 text-white" : "text-stone-300 hover:bg-white/5")}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={() => void logout()} className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-300 hover:bg-white/5">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-border bg-[#f7f4ee]/80 px-6 py-3 backdrop-blur">
          <p className="text-sm text-stone-500">{user?.email}</p>
          <div className="flex items-center gap-3">
            <Menu>
              <MenuTrigger className="relative rounded-lg p-2 hover:bg-accent" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {(notifications.data?.unread ?? 0) > 0 && (
                  <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {notifications.data?.unread}
                  </span>
                )}
              </MenuTrigger>
              <MenuContent>
                <div className="max-h-80 overflow-auto">
                  {(notifications.data?.notifications ?? []).slice(0, 8).map((item) => (
                    <MenuItem key={item.id} onSelect={() => { void api(workspacePath(`/notifications/${item.id}/read`), { method: "POST" }); if (item.link) navigate(item.link); }}>
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-xs text-stone-500">{item.body}</div>
                    </MenuItem>
                  ))}
                  {(notifications.data?.notifications.length ?? 0) === 0 && <div className="px-3 py-2 text-sm text-stone-500">No notifications</div>}
                </div>
                <MenuItem onSelect={() => { void api(workspacePath("/notifications/read-all"), { method: "POST" }); queryClient.invalidateQueries({ queryKey: ["notifications"] }); }}>
                  Mark all as read
                </MenuItem>
                <MenuItem onSelect={() => navigate("/app/notifications")}>Notification history</MenuItem>
              </MenuContent>
            </Menu>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-white">{user ? initials(user.name) : "?"}</span>
          </div>
        </header>
        <main className="px-6 py-6">
          {!user?.emailVerified && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <span>Verify your email to finish setting up the account.</span>
              <button type="button" className="font-semibold text-primary" onClick={() => void api("/api/v1/auth/resend-verification", { method: "POST" })}>Resend</button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
