import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TASK_PRIORITIES, TASK_STATUSES, TASK_STATUS_LABELS } from "@flowboard/shared";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { ApiError, api, workspacePath } from "@/lib/api";
import type { ActivityItem, Attachment, Comment, Task, User } from "@/lib/types";
import { formatDate, fromNow } from "@/lib/utils";
import { useAuth } from "@/lib/store";

interface TaskDetail {
  task: Task;
  comments: Comment[];
  attachments: Attachment[];
  activity: ActivityItem[];
}

export function TaskDrawer({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["task", taskId],
    enabled: Boolean(taskId),
    queryFn: () => api<TaskDetail>(workspacePath(`/tasks/${taskId}`)),
  });
  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(open) => !open && onClose()} title={detail.data?.task.identifier ?? "Task"}>
      {detail.isLoading && <p className="text-sm text-stone-500">Loading task…</p>}
      {detail.data && (
        <TaskEditor
          detail={detail.data}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ["task", taskId] });
            queryClient.invalidateQueries({ queryKey: ["board"] });
          }}
        />
      )}
    </Sheet>
  );
}

function TaskEditor({ detail, onChanged }: { detail: TaskDetail; onChanged: () => void }) {
  const { task } = detail;
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [preview, setPreview] = useState(false);
  const [comment, setComment] = useState("");
  const members = useQuery({
    queryKey: ["project-members", task.projectId],
    queryFn: () => api<{ members: User[] }>(workspacePath(`/projects/${task.projectId}/members`)),
  });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(workspacePath(`/tasks/${task.id}`), { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Task updated");
      onChanged();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Update failed"),
  });
  const addComment = useMutation({
    mutationFn: () => api(workspacePath(`/tasks/${task.id}/comments`), { method: "POST", body: JSON.stringify({ body: comment }) }),
    onSuccess: () => {
      setComment("");
      onChanged();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Comment failed"),
  });
  const removeComment = useMutation({
    mutationFn: (commentId: string) => api(workspacePath(`/comments/${commentId}`), { method: "DELETE" }),
    onSuccess: onChanged,
  });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return api(workspacePath(`/tasks/${task.id}/attachments`), { method: "POST", body });
    },
    onSuccess: () => {
      toast.success("File attached");
      onChanged();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Upload failed"),
  });
  const removeFile = useMutation({
    mutationFn: (id: string) => api(workspacePath(`/attachments/${id}`), { method: "DELETE" }),
    onSuccess: onChanged,
  });
  const me = useAuth((state) => state.user);

  async function download(id: string, fileName: string) {
    const token = useAuth.getState().accessToken;
    const response = await fetch(`${import.meta.env.VITE_API_URL || ""}${workspacePath(`/attachments/${id}/download`)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!response.ok) {
      toast.error("Download was denied");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <Input value={title} onChange={(event) => setTitle(event.target.value)} onBlur={() => title !== task.title && save.mutate({ title })} aria-label="Task title" />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="space-y-1">Status
          <select className="h-10 w-full rounded-lg border border-border bg-white px-2" value={task.status} onChange={(event) => save.mutate({ status: event.target.value })}>
            {TASK_STATUSES.map((status) => <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <label className="space-y-1">Priority
          <select className="h-10 w-full rounded-lg border border-border bg-white px-2" value={task.priority} onChange={(event) => save.mutate({ priority: event.target.value })}>
            {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>
        <label className="space-y-1">Assignee
          <select className="h-10 w-full rounded-lg border border-border bg-white px-2" value={task.assignee?.id ?? ""} onChange={(event) => save.mutate({ assigneeId: event.target.value || null })}>
            <option value="">Unassigned</option>
            {members.data?.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <label className="space-y-1">Estimate (hours)
          <Input type="number" defaultValue={task.estimateHours ?? ""} onBlur={(event) => save.mutate({ estimateHours: event.target.value ? Number(event.target.value) : null })} />
        </label>
        <label className="space-y-1">Start
          <Input type="date" defaultValue={task.startDate?.slice(0, 10) ?? ""} onBlur={(event) => save.mutate({ startDate: event.target.value || null })} />
        </label>
        <label className="space-y-1">Due
          <Input type="date" defaultValue={task.dueDate?.slice(0, 10) ?? ""} onBlur={(event) => save.mutate({ dueDate: event.target.value || null })} />
        </label>
      </div>
      <p className="text-xs text-stone-500">Reporter {task.reporter.name} · {task.sprint ? task.sprint.name : "No sprint"} · {task.projectName}</p>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold">Description</h3>
          <button type="button" className="text-xs font-semibold text-primary" onClick={() => setPreview((value) => !value)}>{preview ? "Edit" : "Preview"}</button>
        </div>
        {preview ? (
          <div className="prose-sm rounded-xl bg-accent/60 p-3 text-sm"><ReactMarkdown>{description || "_No description_"}</ReactMarkdown></div>
        ) : (
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} onBlur={() => description !== (task.description ?? "") && save.mutate({ description })} />
        )}
      </div>
      <section>
        <h3 className="mb-2 text-sm font-bold">Comments</h3>
        <div className="space-y-3">
          {detail.comments.map((item) => (
            <article key={item.id} className="rounded-xl border border-border p-3">
              <div className="mb-1 flex justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-700">{item.author.name}</span>
                <span>{fromNow(item.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{item.body}</p>
              {me?.id === item.author.id && (
                <button type="button" className="mt-1 text-xs text-destructive" onClick={() => removeComment.mutate(item.id)}>Delete</button>
              )}
            </article>
          ))}
        </div>
        <form className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); if (comment.trim()) addComment.mutate(); }}>
          <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment. Mention a teammate with @Name" />
          <Button type="submit" size="sm" disabled={addComment.isPending}>Comment</Button>
        </form>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-bold">Attachments</h3>
        <ul className="space-y-2 text-sm">
          {detail.attachments.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-2">
              <button type="button" className="truncate text-left font-semibold text-primary" onClick={() => download(file.id, file.fileName)}>{file.fileName}</button>
              <span className="text-xs text-stone-500">{Math.ceil(file.size / 1024)} KB · {formatDate(file.createdAt)}</span>
              <button type="button" className="text-xs text-destructive" onClick={() => removeFile.mutate(file.id)}>Remove</button>
            </li>
          ))}
        </ul>
        <Input className="mt-2" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload.mutate(file); }} />
      </section>
      <section>
        <h3 className="mb-2 text-sm font-bold">Activity</h3>
        <ol className="space-y-2 border-l border-border pl-3">
          {detail.activity.map((item) => (
            <li key={item.id} className="text-sm">
              <span className="font-semibold">{item.actor?.name ?? "System"}</span> {item.action.replaceAll(".", " ")} <span className="text-stone-500">{fromNow(item.createdAt)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
