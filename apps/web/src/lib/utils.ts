import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import type { TaskPriority, TaskStatus } from "@flowboard/shared";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null, pattern = "MMM d") {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : new Date(value);
  if (!isValid(date)) return "—";
  return format(date, pattern);
}

export function fromNow(value?: string | null) {
  if (!value) return "";
  const date = parseISO(value);
  if (!isValid(date)) return "";
  return formatDistanceToNow(date, { addSuffix: true });
}

export const priorityTone: Record<TaskPriority, string> = {
  LOW: "bg-stone-100 text-stone-700",
  MEDIUM: "bg-sky-50 text-sky-800",
  HIGH: "bg-amber-50 text-amber-800",
  URGENT: "bg-red-50 text-red-800",
};

export const statusTone: Record<TaskStatus, string> = {
  BACKLOG: "bg-stone-200",
  TODO: "bg-stone-400",
  IN_PROGRESS: "bg-emerald-600",
  IN_REVIEW: "bg-amber-500",
  DONE: "bg-teal-700",
};

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function isOverdue(dueDate?: string | null, status?: string) {
  if (!dueDate || status === "DONE") return false;
  return new Date(dueDate).getTime() < Date.now();
}
