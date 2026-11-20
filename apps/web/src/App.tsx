import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { ForgotPage, InvitePage, LoginPage, RegisterPage, ResetPage, VerifyPage } from "@/pages/AuthPages";
import { ActivityPage, BillingPage, DashboardPage, NotificationsPage, PricingPage, ProjectPage, ProjectsPage, SettingsPage, SprintPage, SprintsPage, TeamPage } from "@/pages/WorkspacePages";

function Boot({ children }: { children: ReactNode }) {
  const booted = useAuth((state) => state.booted);
  const setBooted = useAuth((state) => state.setBooted);
  const setSession = useAuth((state) => state.setSession);
  const clear = useAuth((state) => state.clear);
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (!useAuth.getState().accessToken) {
          const refreshed = await api<{ accessToken: string; user: never; workspaces: never[] }>("/api/v1/auth/refresh", { method: "POST" });
          if (!cancelled) setSession(refreshed);
        }
        const me = await api<{ user: NonNullable<ReturnType<typeof useAuth.getState>["user"]>; workspaces: ReturnType<typeof useAuth.getState>["workspaces"] }>("/api/v1/auth/me");
        if (!cancelled) {
          setSession({
            accessToken: useAuth.getState().accessToken ?? "",
            user: me.user,
            workspaces: me.workspaces,
            workspaceId: useAuth.getState().workspaceId,
          });
        }
      } catch {
        if (!useAuth.getState().accessToken) clear();
      } finally {
        if (!cancelled) setBooted(true);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [clear, setBooted, setSession]);
  if (!booted) return <div className="grid min-h-screen place-items-center text-sm text-stone-500">Opening Flowboard…</div>;
  return children;
}

function RequireAuth() {
  const token = useAuth((state) => state.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export function App() {
  return (
    <Boot>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPage />} />
        <Route path="/reset-password" element={<ResetPage />} />
        <Route path="/verify-email" element={<VerifyPage />} />
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/app" element={<RequireAuth />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectPage />} />
          <Route path="sprints" element={<SprintsPage />} />
          <Route path="sprints/:sprintId" element={<SprintPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Boot>
  );
}
