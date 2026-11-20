import { MessageSquare } from "lucide-react";
import { PRIORITY_LABELS } from "@flowboard/shared";
import type { Task } from "@/lib/types";
import { formatDate, initials, isOverdue, priorityTone } from "@/lib/utils";

export function TaskCard({ task, onOpen }: { task: Task; onOpen?: () => void }) {
  const overdue = isOverdue(task.dueDate, task.status);
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-xl border border-border bg-white p-3 text-left shadow-sm transition hover:-translate-y-px hover:shadow">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-wide text-stone-500">{task.identifier}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${priorityTone[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>
      </div>
      <p className="text-sm font-semibold leading-snug text-stone-900">{task.title}</p>
      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span key={label.id} className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: label.color }}>
              {label.name}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
        <span className={overdue ? "font-semibold text-destructive" : ""}>{task.dueDate ? formatDate(task.dueDate) : "No date"}</span>
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {task.commentCount}
          </span>
          <span className="grid h-6 w-6 place-items-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-700" title={task.assignee?.name ?? "Unassigned"}>
            {task.assignee ? initials(task.assignee.name) : "–"}
          </span>
        </span>
      </div>
    </button>
  );
}
