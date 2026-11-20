import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskCard } from "@/components/tasks/TaskCard";
import type { Task } from "@/lib/types";

const task: Task = {
  id: "1",
  identifier: "WEB-3",
  number: 3,
  projectId: "p",
  projectKey: "WEB",
  title: "Project dashboard layout",
  description: null,
  status: "IN_PROGRESS",
  priority: "HIGH",
  position: 1,
  assignee: { id: "u", email: "leo@acme.flowboard.dev", name: "Leo Member", avatarUrl: null, emailVerified: true },
  reporter: { id: "r", email: "priya@acme.flowboard.dev", name: "Priya Manager", avatarUrl: null, emailVerified: true },
  startDate: null,
  dueDate: "2026-11-21T00:00:00.000Z",
  estimateHours: 4,
  labels: [{ id: "l", name: "Feature", color: "#0f6e56" }],
  commentCount: 2,
  attachmentCount: 0,
  sprint: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

describe("TaskCard", () => {
  it("shows the identifier, priority, assignee, and comment count", () => {
    render(<TaskCard task={task} />);
    expect(screen.getByText("WEB-3")).toBeInTheDocument();
    expect(screen.getByText("Project dashboard layout")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByTitle("Leo Member")).toBeInTheDocument();
  });
});
