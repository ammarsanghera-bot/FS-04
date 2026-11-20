import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { hasPermission } from "@flowboard/shared";
import { positionBetween } from "../src/lib/position.js";
import { app, register, resetDatabase } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";

beforeEach(async () => {
  await resetDatabase();
});

describe("auth", () => {
  it("registers, logs in, refreshes, and logs out", async () => {
    const created = await register("ada@example.com", "Ada Co");
    expect(created.status).toBe(201);
    expect(created.body.accessToken).toBeTruthy();
    expect(created.body.user.email).toBe("ada@example.com");
    expect(created.body.workspaces).toHaveLength(1);

    const agent = request.agent(app);
    const login = await agent.post("/api/v1/auth/login").send({ email: "ada@example.com", password: "Password123!" });
    expect(login.status).toBe(200);
    const refreshed = await agent.post("/api/v1/auth/refresh");
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    const logout = await agent.post("/api/v1/auth/logout");
    expect(logout.status).toBe(204);
    const again = await agent.post("/api/v1/auth/refresh");
    expect(again.status).toBe(401);
  });

  it("rejects a wrong password without revealing whether the email exists", async () => {
    await register("ada@example.com", "Ada Co");
    const response = await request(app).post("/api/v1/auth/login").send({ email: "ada@example.com", password: "wrongpass1" });
    expect(response.status).toBe(401);
  });
});

describe("tenant isolation", () => {
  it("rejects cross-tenant reads and ignores a workspace id in the body", async () => {
    const alpha = await register("alpha@example.com", "Alpha");
    const beta = await register("beta@example.com", "Beta");
    const alphaWorkspace = alpha.body.workspaces[0].id as string;
    const betaWorkspace = beta.body.workspaces[0].id as string;

    const project = await request(app)
      .post(`/api/v1/workspaces/${alphaWorkspace}/projects`)
      .set("Authorization", `Bearer ${alpha.body.accessToken}`)
      .send({ name: "Secret", key: "SEC", workspaceId: betaWorkspace });
    expect(project.status).toBe(201);
    const projectId = project.body.project.id as string;
    const stored = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(stored.workspaceId).toBe(alphaWorkspace);

    const asBeta = await request(app)
      .get(`/api/v1/workspaces/${betaWorkspace}/projects/${projectId}`)
      .set("Authorization", `Bearer ${beta.body.accessToken}`);
    expect(asBeta.status).toBe(404);

    const wrongMembership = await request(app)
      .get(`/api/v1/workspaces/${alphaWorkspace}/projects/${projectId}`)
      .set("Authorization", `Bearer ${beta.body.accessToken}`);
    expect(wrongMembership.status).toBe(403);

    const mismatchedHeader = await request(app)
      .get(`/api/v1/workspaces/${alphaWorkspace}/projects/${projectId}`)
      .set("Authorization", `Bearer ${alpha.body.accessToken}`)
      .set("X-Workspace-Id", betaWorkspace);
    expect(mismatchedHeader.status).toBe(400);

    const task = await request(app)
      .post(`/api/v1/workspaces/${alphaWorkspace}/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${alpha.body.accessToken}`)
      .send({ title: "Hidden" });
    expect(task.status).toBe(201);

    const stolenTask = await request(app)
      .get(`/api/v1/workspaces/${betaWorkspace}/tasks/${task.body.task.id}`)
      .set("Authorization", `Bearer ${beta.body.accessToken}`);
    expect(stolenTask.status).toBe(404);
  });

  it("hides projects a member is not assigned to", async () => {
    const owner = await register("owner@example.com", "Studio");
    const workspaceId = owner.body.workspaces[0].id as string;
    const project = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({ name: "Private", key: "PRV" });
    const invite = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invitations`)
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({ email: "member@example.com", role: "MEMBER" });
    expect(invite.status).toBe(201);

    const tokenRecord = await prisma.invitation.findFirstOrThrow({ where: { email: "member@example.com" } });
    const raw = "member-invite-token-for-test-only-123456";
    const { sha256 } = await import("../src/lib/crypto.js");
    await prisma.invitation.update({ where: { id: tokenRecord.id }, data: { tokenHash: sha256(raw) } });

    const member = await request(app).post("/api/v1/auth/register").send({
      name: "Member",
      email: "member@example.com",
      password: "Password123!",
      workspaceName: "Personal",
    });
    const accepted = await request(app)
      .post("/api/v1/invitations/accept")
      .set("Authorization", `Bearer ${member.body.accessToken}`)
      .send({ token: raw });
    expect(accepted.status).toBe(200);

    const hidden = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/projects/${project.body.project.id}`)
      .set("Authorization", `Bearer ${member.body.accessToken}`);
    expect(hidden.status).toBe(404);

    const billing = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/billing/mock-activate`)
      .set("Authorization", `Bearer ${member.body.accessToken}`)
      .send({ planTier: "PRO" });
    expect(billing.status).toBe(403);
  });
});

describe("permissions and plans", () => {
  it("enforces the permission matrix for owners and members", () => {
    expect(hasPermission("OWNER", "billing:manage")).toBe(true);
    expect(hasPermission("MEMBER", "billing:manage")).toBe(false);
    expect(hasPermission("MANAGER", "sprints:manage")).toBe(true);
    expect(hasPermission("MEMBER", "tasks:delete")).toBe(false);
  });

  it("blocks a fourth active project on the free plan and moves tasks on the board", async () => {
    const owner = await register("limits@example.com", "Limits");
    const workspaceId = owner.body.workspaces[0].id as string;
    const auth = { Authorization: `Bearer ${owner.body.accessToken}` };
    for (const key of ["AA", "BB", "CC"]) {
      const created = await request(app).post(`/api/v1/workspaces/${workspaceId}/projects`).set(auth).send({ name: key, key });
      expect(created.status).toBe(201);
    }
    const blocked = await request(app).post(`/api/v1/workspaces/${workspaceId}/projects`).set(auth).send({ name: "DD", key: "DD" });
    expect(blocked.status).toBe(402);

    const project = await request(app).get(`/api/v1/workspaces/${workspaceId}/projects`).set(auth);
    const projectId = project.body.projects[0].id as string;
    const task = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`)
      .set(auth)
      .send({ title: "Move me", status: "TODO" });
    const moved = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/tasks/${task.body.task.id}/move`)
      .set(auth)
      .send({ status: "IN_PROGRESS" });
    expect(moved.status).toBe(200);
    expect(moved.body.task.status).toBe("IN_PROGRESS");

    const removed = await request(app).delete(`/api/v1/workspaces/${workspaceId}`).set(auth);
    expect(removed.status).toBe(204);
  });
});

describe("ordering", () => {
  it("places a card between its neighbors", () => {
    expect(positionBetween(null, null)).toBe(1024);
    expect(positionBetween(1000, 3000)).toBe(2000);
    expect(positionBetween(null, 500)).toBeLessThan(500);
  });
});
