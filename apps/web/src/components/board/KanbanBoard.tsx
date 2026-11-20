import { DndContext, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TASK_PRIORITIES, TASK_STATUS_LABELS, type TaskPriority, type TaskStatus } from "@flowboard/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/field";
import { ApiError, api, workspacePath } from "@/lib/api";
import type { BoardColumn, Task, User } from "@/lib/types";
import { statusTone } from "@/lib/utils";

interface BoardResponse {
  columns: BoardColumn[];
}

export function KanbanBoard({ projectId, onOpen }: { projectId: string; onOpen: (taskId: string) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("");
  const [labelId, setLabelId] = useState("");
  const [due, setDue] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (assigneeId) params.set("assigneeId", assigneeId);
  if (priority) params.set("priority", priority);
  if (labelId) params.set("labelId", labelId);
  if (due === "overdue") params.set("dueBefore", new Date().toISOString());
  if (due === "week") params.set("dueBefore", new Date(Date.now() + 7 * 86400000).toISOString());

  const board = useQuery({
    queryKey: ["board", projectId, params.toString()],
    queryFn: () => api<BoardResponse>(workspacePath(`/projects/${projectId}/board?${params.toString()}`)),
  });
  const members = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => api<{ members: User[] }>(workspacePath(`/projects/${projectId}/members`)),
  });
  const labels = useQuery({
    queryKey: ["labels"],
    queryFn: () => api<{ labels: { id: string; name: string }[] }>(workspacePath("/labels")),
  });

  const move = useMutation({
    mutationFn: (input: { taskId: string; status: TaskStatus; beforeTaskId: string | null; afterTaskId: string | null }) =>
      api(workspacePath(`/tasks/${input.taskId}/move`), {
        method: "POST",
        body: JSON.stringify({ status: input.status, beforeTaskId: input.beforeTaskId, afterTaskId: input.afterTaskId }),
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["board", projectId] });
      const key = ["board", projectId, params.toString()];
      const previous = queryClient.getQueryData<BoardResponse>(key);
      if (previous) {
        const columns = previous.columns.map((column) => ({ ...column, tasks: column.tasks.filter((task) => task.id !== input.taskId) }));
        const moving = previous.columns.flatMap((column) => column.tasks).find((task) => task.id === input.taskId);
        const target = columns.find((column) => column.status === input.status);
        if (moving && target) {
          const next = { ...moving, status: input.status };
          const index = input.afterTaskId ? target.tasks.findIndex((task) => task.id === input.afterTaskId) : target.tasks.length;
          const tasks = [...target.tasks];
          tasks.splice(index < 0 ? tasks.length : index, 0, next);
          target.tasks = tasks;
        }
        queryClient.setQueryData(key, { columns });
      }
      return { previous, key };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
      toast.error(error instanceof ApiError ? error.message : "Could not move the task");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["board", projectId] }),
  });

  function onDragEnd(event: DragEndEvent) {
    if (!event.over || !board.data) return;
    const taskId = String(event.active.id);
    const overId = String(event.over.id);
    const all = board.data.columns.flatMap((column) => column.tasks);
    const current = all.find((task) => task.id === taskId);
    if (!current) return;
    let status: TaskStatus = current.status;
    let beforeTaskId: string | null = null;
    let afterTaskId: string | null = null;
    if (overId.startsWith("column:")) {
      status = overId.slice(7) as TaskStatus;
      const columnTasks = all.filter((task) => task.status === status && task.id !== taskId);
      beforeTaskId = columnTasks.at(-1)?.id ?? null;
    } else {
      const over = all.find((task) => task.id === overId);
      if (!over || over.id === taskId) return;
      status = over.status;
      afterTaskId = over.id;
    }
    if (status === current.status && !beforeTaskId && !afterTaskId) return;
    move.mutate({ taskId, status, beforeTaskId, afterTaskId });
  }

  if (board.isLoading) return <p className="text-sm text-stone-500">Loading board…</p>;
  if (board.isError) return <p className="text-sm text-destructive">The board could not be loaded.</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks" className="max-w-xs" />
        <select className="h-10 rounded-lg border border-border bg-white px-2 text-sm" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} aria-label="Filter by assignee">
          <option value="">All assignees</option>
          <option value="me">Assigned to me</option>
          {members.data?.members.map((member) => (
            <option key={member.id} value={member.id}>{member.name}</option>
          ))}
        </select>
        <select className="h-10 rounded-lg border border-border bg-white px-2 text-sm" value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter by priority">
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="h-10 rounded-lg border border-border bg-white px-2 text-sm" value={labelId} onChange={(event) => setLabelId(event.target.value)} aria-label="Filter by label">
          <option value="">All labels</option>
          {labels.data?.labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}
        </select>
        <select className="h-10 rounded-lg border border-border bg-white px-2 text-sm" value={due} onChange={(event) => setDue(event.target.value)} aria-label="Filter by due date">
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="week">Due in 7 days</option>
        </select>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {board.data?.columns.map((column) => (
            <Column key={column.id} column={column} projectId={projectId} onOpen={onOpen} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({ column, projectId, onOpen }: { column: BoardColumn; projectId: string; onOpen: (taskId: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.status}` });
  return (
    <section className={`w-72 shrink-0 rounded-2xl bg-[#ebe4d8] p-2 ${isOver ? "ring-2 ring-primary" : ""}`}>
      <header className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusTone[column.status]}`} />
          <h3 className="text-sm font-bold">{TASK_STATUS_LABELS[column.status]}</h3>
          <span className="text-xs text-stone-500">{column.tasks.length}</span>
        </div>
        <CreateTask projectId={projectId} status={column.status} />
      </header>
      <SortableContext items={column.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-24 flex-col gap-2">
          {column.tasks.map((task) => (
            <SortableTask key={task.id} task={task} onOpen={() => onOpen(task.id)} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableTask({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners}>
      <TaskCard task={task} onOpen={onOpen} />
    </div>
  );
}

function CreateTask({ projectId, status }: { projectId: string; status: TaskStatus }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [error, setError] = useState("");
  const create = useMutation({
    mutationFn: () =>
      api(workspacePath(`/projects/${projectId}/tasks`), {
        method: "POST",
        body: JSON.stringify({ title, status, priority }),
      }),
    onSuccess: () => {
      setTitle("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      toast.success("Task created");
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Could not create the task"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" className="rounded-md p-1 hover:bg-white" aria-label={`Add task to ${TASK_STATUS_LABELS[status]}`} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
      </button>
      <DialogContent title="New task">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) {
              setError("Add a title");
              return;
            }
            create.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="task-priority">Priority</Label>
            <select id="task-priority" className="h-10 w-full rounded-lg border border-border bg-white px-2 text-sm" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              {TASK_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <FieldError message={error} />
          <Button type="submit" disabled={create.isPending}>Create task</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
