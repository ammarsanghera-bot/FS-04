import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PLAN_DEFINITIONS, PROJECT_STATUSES, PROJECT_STATUS_LABELS, ROLE_LABELS, WORKSPACE_ROLES, formatPrice, hasPermission, type ProjectStatus, type WorkspaceRole } from "@flowboard/shared";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { KanbanBoard } from "@/components/board/KanbanBoard";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/menu";
import { ApiError, api, workspacePath } from "@/lib/api";
import { currentRole, useAuth } from "@/lib/store";
import type { ActivityItem, NotificationItem, ProjectSummary, User } from "@/lib/types";
import { formatDate, fromNow } from "@/lib/utils";

const COLORS = ["#0f6e56", "#9a6b2f", "#57534e", "#b45309", "#1d4ed8"];

export function DashboardPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const report = useQuery({
    queryKey: ["dashboard", from, to],
    queryFn: () => api<DashboardReport>(workspacePath(`/reports/dashboard?from=${from}&to=${to}`)),
  });
  const data = report.data;
  if (!data) return <p className="text-sm text-stone-500">Loading the workspace…</p>;
  const cards = [
    ["Projects", data.totals.projects],
    ["Active", data.totals.activeProjects],
    ["Tasks", data.totals.tasks],
    ["Completed", data.totals.completedTasks],
    ["Overdue", data.totals.overdueTasks],
    ["Assigned to me", data.totals.assignedToMe],
    ["Done this week", data.totals.completedThisWeek],
    ["Upcoming", data.totals.upcomingDeadlines],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Workspace</h1>
          <p className="text-sm text-stone-500">Live counts from this workspace.</p>
        </div>
        <div className="flex gap-2">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl border border-border bg-card px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
            <p className="font-display mt-1 text-3xl font-semibold">{value}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Task status">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.statusDistribution}>
              <CartesianGrid stroke="#eee7dc" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f6e56" radius={6} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 font-display text-lg font-semibold">Upcoming deadlines</h2>
          <ul className="space-y-2">
            {data.upcoming.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span><span className="font-mono text-xs text-stone-500">{item.identifier}</span> {item.title}</span>
                <span className="text-stone-500">{formatDate(item.dueDate)}</span>
              </li>
            ))}
            {data.upcoming.length === 0 && <li className="text-sm text-stone-500">Nothing due in the next week.</li>}
          </ul>
        </section>
      </div>
      {data.locked ? (
        <div className="rounded-2xl border border-dashed border-border bg-accent/50 p-6">
          <h2 className="font-display text-xl font-semibold">Advanced reports are on Pro and Business</h2>
          <p className="mt-1 text-sm text-stone-600">Completion over time, project progress, workload, and priority stay locked on Free.</p>
          <Link to="/app/billing" className="mt-3 inline-block text-sm font-semibold text-primary">Review plans</Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Completed over time">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.completionOverTime}>
                <CartesianGrid stroke="#eee7dc" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0f6e56" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Priority">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.priorityDistribution} dataKey="count" nameKey="priority" innerRadius={50} outerRadius={80}>
                  {data.priorityDistribution.map((entry, index) => <Cell key={entry.priority} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Project progress">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.projectProgress}>
                <CartesianGrid stroke="#eee7dc" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="percent" fill="#9a6b2f" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Team workload">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.workload}>
                <CartesianGrid stroke="#eee7dc" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="open" stackId="a" fill="#0f6e56" />
                <Bar dataKey="done" stackId="a" fill="#d6d3d1" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-2 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

interface DashboardReport {
  totals: Record<string, number>;
  upcoming: { id: string; identifier: string; title: string; dueDate: string | null }[];
  statusDistribution: { status: string; count: number }[];
  completionOverTime: { date: string; count: number }[];
  projectProgress: { name: string; percent: number }[];
  workload: { name: string; open: number; done: number }[];
  priorityDistribution: { priority: string; count: number }[];
  locked: boolean;
}

export function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const role = currentRole();
  const projects = useQuery({
    queryKey: ["projects", search],
    queryFn: () => api<{ projects: ProjectSummary[] }>(workspacePath(`/projects?search=${encodeURIComponent(search)}`)),
  });
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Projects</h1>
        {role && hasPermission(role, "projects:create") && <Button onClick={() => setOpen(true)}>New project</Button>}
      </div>
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" className="mb-4 max-w-sm" />
      <div className="grid gap-3 md:grid-cols-2">
        {projects.data?.projects.map((project) => (
          <Link key={project.id} to={`/app/projects/${project.id}`} className="rounded-2xl border border-border bg-card p-4 hover:border-primary">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-stone-500">{project.key}</span>
              <span className="text-xs font-semibold">{PROJECT_STATUS_LABELS[project.status]}</span>
            </div>
            <h2 className="mt-1 font-display text-xl font-semibold">{project.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-stone-600">{project.description}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full bg-primary" style={{ width: `${project.progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-stone-500">{project.completedCount}/{project.taskCount} tasks · {project.memberCount} people</p>
          </Link>
        ))}
      </div>
      <ProjectDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function ProjectDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (open: boolean) => void; project?: ProjectSummary }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(project?.name ?? "");
  const [key, setKey] = useState(project?.key ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "PLANNING");
  const [startDate, setStartDate] = useState(project?.startDate?.slice(0, 10) ?? "");
  const [deadline, setDeadline] = useState(project?.deadline?.slice(0, 10) ?? "");
  const save = useMutation({
    mutationFn: async () => {
      const body = { name, key: key || undefined, description, status, startDate: startDate || null, deadline: deadline || null };
      if (project) {
        await api(workspacePath(`/projects/${project.id}`), { method: "PATCH", body: JSON.stringify(body) });
        return null;
      }
      return api<{ project: { id: string } }>(workspacePath("/projects"), { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project"] });
      onOpenChange(false);
      if (result?.project.id) navigate(`/app/projects/${result.project.id}`);
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not save the project"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={project ? "Edit project" : "New project"}>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <Label>Name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
          <Label>Key</Label>
          <Input value={key} onChange={(event) => setKey(event.target.value.toUpperCase())} maxLength={6} placeholder="WEB" />
          <Label>Description</Label>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          <Label>Status</Label>
          <select className="h-10 w-full rounded-lg border border-border bg-white px-2" value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>
            {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{PROJECT_STATUS_LABELS[item]}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Start date" />
            <Input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} aria-label="Deadline" />
          </div>
          <Button type="submit" disabled={save.isPending}>Save project</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectPage() {
  const { projectId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const role = currentRole();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api<ProjectDetail>(workspacePath(`/projects/${projectId}`)),
  });
  const archive = useMutation({
    mutationFn: () => api(workspacePath(`/projects/${projectId}`), { method: "PATCH", body: JSON.stringify({ status: "ARCHIVED" }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
  });
  const remove = useMutation({
    mutationFn: () => api(workspacePath(`/projects/${projectId}`), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  if (!detail.data) return <p className="text-sm text-stone-500">Loading project…</p>;
  const { project, progress, members, upcomingDeadlines, recentActivity } = detail.data;
  const summary: ProjectSummary = {
    ...project,
    lead: project.lead,
    memberCount: members.length,
    taskCount: progress.total,
    completedCount: progress.completed,
    progress: progress.percent,
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-stone-500">{project.key}</p>
          <h1 className="font-display text-3xl font-semibold">{project.name}</h1>
          <p className="max-w-2xl text-sm text-stone-600">{project.description}</p>
        </div>
        <div className="flex gap-2">
          {role && hasPermission(role, "projects:update") && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
          {role && hasPermission(role, "projects:update") && <Button variant="secondary" onClick={() => archive.mutate()}>Archive</Button>}
          {role && hasPermission(role, "projects:delete") && <Button variant="danger" onClick={() => remove.mutate()}>Delete</Button>}
        </div>
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="sprints">Sprints</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="Progress" value={`${progress.percent}%`} />
            <Stat label="Tasks" value={String(progress.total)} />
            <Stat label="Completed" value={String(progress.completed)} />
            <Stat label="Overdue" value={String(progress.overdue)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
              <h2 className="font-display text-lg font-semibold">Upcoming deadlines</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {upcomingDeadlines.map((task) => (
                  <li key={task.id}><span className="font-mono text-xs">{task.identifier}</span> {task.title} · {formatDate(task.dueDate)}</li>
                ))}
              </ul>
              <h2 className="mt-5 font-display text-lg font-semibold">Recent activity</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {recentActivity.map((item) => (
                  <li key={item.id}>{item.actor?.name ?? "System"} {item.action.replaceAll(".", " ")} · {fromNow(item.createdAt)}</li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="font-display text-lg font-semibold">Team</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {members.map((member) => <li key={member.id}>{member.name}</li>)}
              </ul>
              <p className="mt-3 text-xs text-stone-500">Lead {project.lead?.name ?? "Unassigned"} · {PROJECT_STATUS_LABELS[project.status]}</p>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="board" className="mt-4">
          <KanbanBoard projectId={projectId} onOpen={(taskId) => setParams({ task: taskId })} />
        </TabsContent>
        <TabsContent value="sprints" className="mt-4">
          <SprintList projectId={projectId} />
        </TabsContent>
      </Tabs>
      <TaskDrawer taskId={params.get("task")} onClose={() => setParams({})} />
      <ProjectDialog open={editing} onOpenChange={setEditing} project={summary} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
    </article>
  );
}

interface ProjectDetail {
  project: {
    id: string;
    name: string;
    key: string;
    description: string | null;
    status: ProjectStatus;
    startDate: string | null;
    deadline: string | null;
    lead: User | null;
  };
  members: User[];
  progress: { total: number; completed: number; overdue: number; percent: number };
  upcomingDeadlines: { id: string; identifier: string; title: string; dueDate: string | null }[];
  recentActivity: ActivityItem[];
}

export function SprintsPage() {
  const projects = useQuery({ queryKey: ["projects", "sprint-create"], queryFn: () => api<{ projects: ProjectSummary[] }>(workspacePath("/projects")) });
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const role = currentRole();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">Sprints</h1>
      {role && hasPermission(role, "sprints:manage") && (
        <form
          className="grid gap-2 rounded-2xl border border-border bg-card p-4 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            api(workspacePath("/sprints"), { method: "POST", body: JSON.stringify({ projectId, name, goal, startDate: startDate || null, endDate: endDate || null }) })
              .then(() => {
                setName("");
                queryClient.invalidateQueries({ queryKey: ["sprints"] });
                toast.success("Sprint planned");
              })
              .catch((error) => toast.error(error instanceof ApiError ? error.message : "Could not create the sprint"));
          }}
        >
          <select className="h-10 rounded-lg border border-border bg-white px-2" value={projectId} onChange={(event) => setProjectId(event.target.value)} required aria-label="Project">
            <option value="">Project</option>
            {projects.data?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Sprint name" required aria-label="Sprint name" />
          <Input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Goal" aria-label="Sprint goal" />
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Sprint start" />
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="Sprint end" />
          <Button type="submit" className="md:col-span-5 md:w-fit">Plan sprint</Button>
        </form>
      )}
      <SprintList />
    </div>
  );
}

function SprintList({ projectId }: { projectId?: string }) {
  const query = projectId ? `?projectId=${projectId}` : "";
  const sprints = useQuery({
    queryKey: ["sprints", projectId ?? "all"],
    queryFn: () => api<{ sprints: SprintRow[] }>(workspacePath(`/sprints${query}`)),
  });
  return (
    <div className="space-y-3">
      {sprints.data?.sprints.map((sprint) => (
        <Link key={sprint.id} to={`/app/sprints/${sprint.id}`} className="block rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{sprint.name}</h2>
            <span className="text-xs font-bold">{sprint.status}</span>
          </div>
          <p className="text-sm text-stone-600">{sprint.goal}</p>
          <p className="mt-2 text-xs text-stone-500">{sprint.project.key} · {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)} · {sprint.percent}% complete</p>
        </Link>
      ))}
    </div>
  );
}

interface SprintRow {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  project: { id: string; key: string; name: string };
  percent: number;
}

export function SprintPage() {
  const { sprintId = "" } = useParams();
  const role = currentRole();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["sprint", sprintId],
    queryFn: () => api<SprintDetail>(workspacePath(`/sprints/${sprintId}`)),
  });
  const action = useMutation({
    mutationFn: (path: string) => api(workspacePath(`/sprints/${sprintId}/${path}`), { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprint", sprintId] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Sprint update failed"),
  });
  const add = useMutation({
    mutationFn: (taskId: string) => api(workspacePath(`/sprints/${sprintId}/tasks`), { method: "POST", body: JSON.stringify({ taskId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprint", sprintId] }),
  });
  const remove = useMutation({
    mutationFn: (taskId: string) => api(workspacePath(`/sprints/${sprintId}/tasks/${taskId}`), { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprint", sprintId] }),
  });
  if (!detail.data) return <p className="text-sm text-stone-500">Loading sprint…</p>;
  const { sprint, tasks, backlog, report } = detail.data;
  const canManage = role && hasPermission(role, "sprints:manage");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{sprint.name}</h1>
          <p className="text-sm text-stone-600">{sprint.goal}</p>
          <p className="text-xs text-stone-500">{sprint.status} · {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}</p>
        </div>
        {canManage && sprint.status === "PLANNED" && <Button onClick={() => action.mutate("start")}>Start sprint</Button>}
        {canManage && sprint.status === "ACTIVE" && <Button onClick={() => action.mutate("complete")}>Complete sprint</Button>}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Tasks" value={String(report.total)} />
        <Stat label="Completed" value={String(report.completed)} />
        <Stat label="Incomplete" value={String(report.incomplete)} />
        <Stat label="Completion" value={`${report.percent}%`} />
      </div>
      <ChartCard title="Tasks by status">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={report.byStatus}><XAxis dataKey="status" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#0f6e56" radius={6} /></BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">Sprint tasks</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-2">
                <span><span className="font-mono text-xs">{task.identifier}</span> {task.title} · {task.status}</span>
                {canManage && <button type="button" className="text-xs text-destructive" onClick={() => remove.mutate(task.id)}>Remove</button>}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">Backlog</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {backlog.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-2">
                <span>{task.identifier} {task.title}</span>
                {canManage && <button type="button" className="text-xs font-semibold text-primary" onClick={() => add.mutate(task.id)}>Add</button>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

interface SprintDetail {
  sprint: { id: string; name: string; goal: string | null; status: string; startDate: string | null; endDate: string | null };
  tasks: { id: string; identifier: string; title: string; status: string }[];
  backlog: { id: string; identifier: string; title: string }[];
  report: { total: number; completed: number; incomplete: number; percent: number; byStatus: { status: string; count: number }[] };
}

export function TeamPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("MEMBER");
  const actor = currentRole();
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: ["members", search, roleFilter],
    queryFn: () => api<{ members: MemberRow[] }>(workspacePath(`/members?search=${encodeURIComponent(search)}&role=${roleFilter}`)),
  });
  const invitations = useQuery({
    queryKey: ["invitations"],
    queryFn: () => api<{ invitations: InvitationRow[] }>(workspacePath("/invitations")),
  });
  const invite = useMutation({
    mutationFn: () => api(workspacePath("/invitations"), { method: "POST", body: JSON.stringify({ email, role }) }),
    onSuccess: () => {
      setEmail("");
      toast.success("Invitation sent");
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Invite failed"),
  });
  const canManage = actor && hasPermission(actor, "members:manage");
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Team</h1>
      <div className="flex flex-wrap gap-2">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members" className="max-w-xs" />
        <select className="h-10 rounded-lg border border-border bg-white px-2" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
          <option value="ALL">All roles</option>
          {WORKSPACE_ROLES.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
        </select>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {members.data?.members.map((member) => (
          <div key={member.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
            <div>
              <p className="font-semibold">{member.user.name}</p>
              <p className="text-xs text-stone-500">{member.user.email}</p>
            </div>
            {canManage ? (
              <select
                className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
                value={member.role}
                aria-label={`Role for ${member.user.name}`}
                onChange={(event) => api(workspacePath(`/members/${member.id}`), { method: "PATCH", body: JSON.stringify({ role: event.target.value }) }).then(() => queryClient.invalidateQueries({ queryKey: ["members"] })).catch((error) => toast.error(error instanceof ApiError ? error.message : "Could not change role"))}
              >
                {WORKSPACE_ROLES.map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
              </select>
            ) : <span className="text-sm">{ROLE_LABELS[member.role]}</span>}
            {canManage && <button type="button" className="text-xs text-destructive" onClick={() => api(workspacePath(`/members/${member.id}`), { method: "DELETE" }).then(() => queryClient.invalidateQueries({ queryKey: ["members"] }))}>Remove</button>}
          </div>
        ))}
      </div>
      {canManage && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); invite.mutate(); }}>
          <div><Label htmlFor="invite-email">Invite</Label><Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <select className="h-10 rounded-lg border border-border bg-white px-2" value={role} onChange={(event) => setRole(event.target.value as WorkspaceRole)} aria-label="Invitation role">
            {WORKSPACE_ROLES.filter((item) => item !== "OWNER").map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}
          </select>
          <Button type="submit">Send invite</Button>
        </form>
      )}
      <section>
        <h2 className="font-display mb-2 text-xl font-semibold">Invitations</h2>
        <ul className="space-y-2">
          {invitations.data?.invitations.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <span>{invitation.email} · {invitation.role} · {invitation.status}</span>
              {canManage && invitation.status === "PENDING" && (
                <span className="flex gap-3">
                  <button type="button" className="font-semibold text-primary" onClick={() => api(workspacePath(`/invitations/${invitation.id}/resend`), { method: "POST" }).then(() => toast.success("Resent"))}>Resend</button>
                  <button type="button" className="text-destructive" onClick={() => api(workspacePath(`/invitations/${invitation.id}`), { method: "DELETE" }).then(() => queryClient.invalidateQueries({ queryKey: ["invitations"] }))}>Cancel</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

interface MemberRow { id: string; role: WorkspaceRole; user: User }
interface InvitationRow { id: string; email: string; role: WorkspaceRole; status: string }

export function ActivityPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const activity = useQuery({
    queryKey: ["activity", action, entityType],
    queryFn: () => api<{ items: ActivityItem[] }>(workspacePath(`/activity?action=${action}&entityType=${entityType}`)),
  });
  return (
    <div>
      <h1 className="font-display mb-4 text-3xl font-semibold">Activity</h1>
      <div className="mb-4 flex gap-2">
        <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Action, e.g. task.created" className="max-w-xs" />
        <Input value={entityType} onChange={(event) => setEntityType(event.target.value)} placeholder="Entity type" className="max-w-xs" />
      </div>
      <ol className="space-y-2">
        {activity.data?.items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <span className="font-semibold">{item.actor?.name ?? "System"}</span> {item.action} <span className="text-stone-500">{item.entityType}</span>
            <span className="float-right text-xs text-stone-500">{fromNow(item.createdAt)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const notes = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ notifications: NotificationItem[] }>(workspacePath("/notifications")),
  });
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Notifications</h1>
        <Button variant="secondary" onClick={() => api(workspacePath("/notifications/read-all"), { method: "POST" }).then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }))}>Mark all as read</Button>
      </div>
      <ul className="space-y-2">
        {notes.data?.notifications.map((item) => (
          <li key={item.id} className={`rounded-xl border border-border px-4 py-3 ${item.readAt ? "bg-card" : "bg-accent"}`}>
            <button type="button" className="text-left" onClick={() => api(workspacePath(`/notifications/${item.id}/read`), { method: "POST" })}>
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-stone-600">{item.body}</p>
              <p className="text-xs text-stone-500">{fromNow(item.createdAt)}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BillingPage() {
  const queryClient = useQueryClient();
  const billing = useQuery({
    queryKey: ["billing"],
    queryFn: () => api<BillingResponse>(workspacePath("/billing")),
  });
  const change = useMutation({
    mutationFn: async (tier: "FREE" | "PRO" | "BUSINESS") => {
      if (tier === "FREE") return api(workspacePath("/billing/cancel"), { method: "POST", body: JSON.stringify({ when: "now" }) });
      if (billing.data?.mode === "mock") return api(workspacePath("/billing/mock-activate"), { method: "POST", body: JSON.stringify({ planTier: tier }) });
      const checkout = await api<{ url: string | null; mode: string }>(workspacePath("/billing/checkout"), { method: "POST", body: JSON.stringify({ planTier: tier }) });
      if (checkout.url) window.location.href = checkout.url;
      return checkout;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing"] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Billing update failed"),
  });
  if (!billing.data) return <p className="text-sm text-stone-500">Loading billing…</p>;
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-semibold">Billing</h1>
      {billing.data.mode === "mock" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">Demo billing mode. Stripe keys are not configured, so plan changes stay inside this workspace and are labeled as a demo.</div>
      )}
      <p className="text-sm">Current plan: <strong>{billing.data.plan.name}</strong> · {billing.data.subscription.status}{billing.data.subscription.cancelAtPeriodEnd ? " · cancels at period end" : ""}</p>
      <p className="text-sm text-stone-600">Usage: {billing.data.usage.projects} projects · {billing.data.usage.members} members · {billing.data.usage.tasks} tasks</p>
      <div className="grid gap-3 md:grid-cols-3">
        {PLAN_DEFINITIONS.map((plan) => (
          <article key={plan.tier} className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
            <p className="font-display text-3xl font-semibold">{formatPrice(plan.monthlyPriceCents)}<span className="text-sm font-normal text-stone-500">/mo</span></p>
            <p className="mt-2 text-sm text-stone-600">{plan.description}</p>
            <ul className="mt-3 space-y-1 text-sm">
              <li>{plan.maxProjects ?? "Unlimited"} projects</li>
              <li>{plan.maxMembers ?? "Unlimited"} members</li>
              <li>{plan.maxTasks ?? "Unlimited"} tasks</li>
              <li>{plan.advancedReports ? "Advanced reports" : "Basic reports"}</li>
              <li>{plan.prioritySupport ? "Priority support" : "Standard support"}</li>
              <li>{plan.customIntegrations ? "Custom integrations" : "No custom integrations"}</li>
            </ul>
            <Button className="mt-4" variant={billing.data?.plan.tier === plan.tier ? "secondary" : "default"} disabled={billing.data?.plan.tier === plan.tier || change.isPending} onClick={() => change.mutate(plan.tier)}>
              {billing.data?.plan.tier === plan.tier ? "Current plan" : "Choose"}
            </Button>
          </article>
        ))}
      </div>
      {billing.data.mode === "stripe" && <Button variant="secondary" onClick={() => api<{ url: string }>(workspacePath("/billing/portal"), { method: "POST" }).then((result) => { window.location.href = result.url; })}>Open billing portal</Button>}
      <Button variant="secondary" onClick={() => api(workspacePath("/billing/cancel"), { method: "POST", body: JSON.stringify({ when: "period_end" }) }).then(() => queryClient.invalidateQueries({ queryKey: ["billing"] }))}>Cancel at period end</Button>
    </div>
  );
}

interface BillingResponse {
  mode: "mock" | "stripe";
  plan: { name: string; tier: "FREE" | "PRO" | "BUSINESS" };
  subscription: { status: string; cancelAtPeriodEnd: boolean };
  usage: { projects: number; members: number; tasks: number };
}

export function SettingsPage() {
  const { user, setUser, workspaceId, workspaces } = useAuth();
  const current = workspaces.find((workspace) => workspace.id === workspaceId);
  const [name, setName] = useState(user?.name ?? "");
  const [workspaceName, setWorkspaceName] = useState(current?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api<{ sessions: { id: string; userAgent: string | null; current: boolean; createdAt: string }[] }>("/api/v1/auth/sessions") });
  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="font-display text-3xl font-semibold">Settings</h1>
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault();
        const result = await api<{ user: User }>("/api/v1/auth/me", { method: "PATCH", body: JSON.stringify({ name }) });
        setUser(result.user);
        toast.success("Profile saved");
      }}>
        <h2 className="font-display text-xl font-semibold">Profile</h2>
        <Label htmlFor="profile-name">Name</Label>
        <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} />
        <Label htmlFor="avatar">Avatar</Label>
        <Input id="avatar" type="file" accept="image/*" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const body = new FormData();
          body.append("file", file);
          await api("/api/v1/auth/avatar", { method: "POST", body });
          toast.success("Avatar updated");
        }} />
        <Button type="submit">Save profile</Button>
      </form>
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault();
        try {
          await api("/api/v1/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
          toast.success("Password changed");
        } catch (error) {
          toast.error(error instanceof ApiError ? error.message : "Could not change password");
        }
      }}>
        <h2 className="font-display text-xl font-semibold">Password</h2>
        <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" aria-label="Current password" />
        <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" aria-label="New password" />
        <Button type="submit">Change password</Button>
      </form>
      <section className="space-y-2">
        <h2 className="font-display text-xl font-semibold">Sessions</h2>
        {sessions.data?.sessions.map((session) => (
          <div key={session.id} className="flex items-center justify-between text-sm">
            <span>{session.userAgent ?? "Unknown device"} {session.current ? "· this device" : ""} · {fromNow(session.createdAt)}</span>
            {!session.current && <button type="button" className="text-destructive" onClick={() => api(`/api/v1/auth/sessions/${session.id}`, { method: "DELETE" })}>Revoke</button>}
          </div>
        ))}
      </section>
      {current && hasPermission(current.role, "workspace:update") && (
        <form className="space-y-3" onSubmit={async (event) => {
          event.preventDefault();
          await api(workspacePath(""), { method: "PATCH", body: JSON.stringify({ name: workspaceName }) });
          toast.success("Workspace updated");
        }}>
          <h2 className="font-display text-xl font-semibold">Workspace</h2>
          <Input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} aria-label="Workspace name" />
          <Button type="submit">Save workspace</Button>
        </form>
      )}
      {current?.role === "OWNER" && (
        <Button variant="danger" onClick={async () => {
          await api(workspacePath(""), { method: "DELETE" });
          toast.success("Workspace deleted");
        }}>Delete workspace</Button>
      )}
    </div>
  );
}

export function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">Plans</h1>
      <p className="mt-2 text-stone-600">Limits are enforced on the API for each workspace.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PLAN_DEFINITIONS.map((plan) => (
          <article key={plan.tier} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl font-semibold">{plan.name}</h2>
            <p className="font-display text-3xl">{formatPrice(plan.monthlyPriceCents)}</p>
            <p className="mt-2 text-sm">{plan.description}</p>
            <Link to="/register" className="mt-4 inline-block text-sm font-semibold text-primary">Start</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
