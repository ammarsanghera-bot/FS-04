import { AUDIT_ACTIONS, canManageRole, type InviteMemberInput } from "@flowboard/shared";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "@flowboard/shared";
import { PLAN_IDS } from "@flowboard/shared";
import { env } from "../../config/env.js";
import { recordActivity } from "../../lib/audit.js";
import { randomToken, sha256 } from "../../lib/crypto.js";
import { sendEmail } from "../../lib/email.js";
import { Errors } from "../../lib/errors.js";
import { assertCanAdd } from "../../lib/limits.js";
import { notifyUsers } from "../../lib/notify.js";
import { presentUser, userSelect } from "../../lib/presenters.js";
import { prisma } from "../../lib/prisma.js";
import { slugify, uniqueSlug } from "../../lib/slug.js";
import type { TenantContext } from "../../lib/access.js";

const INVITE_DAYS = 7;

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}***@${domain}`;
}

async function assertLastOwnerSafe(workspaceId: string, userId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (member?.role !== "OWNER") return;
  const owners = await prisma.workspaceMember.count({ where: { workspaceId, role: "OWNER" } });
  if (owners <= 1) throw Errors.badRequest("The workspace needs at least one owner");
}

export const workspaceService = {
  async list(userId: string) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId, workspace: { deletedAt: null } },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
      createdAt: membership.workspace.createdAt,
    }));
  },

  async create(userId: string, input: CreateWorkspaceInput) {
    const slug = await uniqueSlug(input.name);
    const workspace = await prisma.workspace.create({ data: { name: input.name.trim(), slug } });
    await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId, role: "OWNER" } });
    await prisma.subscription.create({
      data: { workspaceId: workspace.id, planId: PLAN_IDS.FREE, status: "ACTIVE" },
    });
    await recordActivity({
      workspaceId: workspace.id,
      actorId: userId,
      entityType: "workspace",
      entityId: workspace.id,
      action: AUDIT_ACTIONS.WORKSPACE_CREATED,
      metadata: { name: workspace.name },
    });
    return { id: workspace.id, name: workspace.name, slug: workspace.slug, role: "OWNER" as const };
  },

  async get(tenant: TenantContext) {
    const workspace = await prisma.workspace.findFirst({
      where: { id: tenant.workspaceId, deletedAt: null },
    });
    if (!workspace) throw Errors.notFound("Workspace not found");
    const [members, projects, tasks] = await Promise.all([
      prisma.workspaceMember.count({ where: { workspaceId: tenant.workspaceId } }),
      prisma.project.count({ where: { workspaceId: tenant.workspaceId, deletedAt: null } }),
      prisma.task.count({ where: { workspaceId: tenant.workspaceId, deletedAt: null } }),
    ]);
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: tenant.role,
      counts: { members, projects, tasks },
      createdAt: workspace.createdAt,
    };
  },

  async update(tenant: TenantContext, input: UpdateWorkspaceInput) {
    if (input.slug) {
      const taken = await prisma.workspace.findFirst({
        where: { slug: input.slug, NOT: { id: tenant.workspaceId } },
      });
      if (taken) throw Errors.conflict("That workspace URL is already taken");
    }
    const workspace = await prisma.workspace.update({
      where: { id: tenant.workspaceId },
      data: {
        name: input.name?.trim(),
        slug: input.slug ? slugify(input.slug) : undefined,
      },
    });
    return { id: workspace.id, name: workspace.name, slug: workspace.slug, role: tenant.role };
  },

  async remove(tenant: TenantContext) {
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: tenant.workspaceId } });
    await prisma.workspace.update({
      where: { id: tenant.workspaceId },
      data: {
        deletedAt: new Date(),
        slug: `${workspace.slug}~${workspace.id.slice(0, 8)}`.slice(0, 60),
      },
    });
  },

  async switch(tenant: TenantContext) {
    return this.get(tenant);
  },

  async listMembers(tenant: TenantContext, search?: string, role?: string) {
    const members = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: tenant.workspaceId,
        role: role && role !== "ALL" ? (role as TenantContext["role"]) : undefined,
        user: search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : undefined,
      },
      include: { user: { select: userSelect } },
      orderBy: { createdAt: "asc" },
    });
    return members.map((member) => ({
      id: member.id,
      role: member.role,
      createdAt: member.createdAt,
      user: presentUser(member.user),
    }));
  },

  async updateMemberRole(tenant: TenantContext, memberId: string, role: TenantContext["role"]) {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: tenant.workspaceId },
    });
    if (!member) throw Errors.notFound("Member not found");
    if (!canManageRole(tenant.role, member.role) || !canManageRole(tenant.role, role)) {
      throw Errors.forbidden("You cannot change that role");
    }
    if (member.role === "OWNER" && role !== "OWNER") await assertLastOwnerSafe(tenant.workspaceId, member.userId);
    const updated = await prisma.workspaceMember.update({ where: { id: member.id }, data: { role } });
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "member",
      entityId: member.userId,
      action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
      metadata: { from: member.role, to: role },
    });
    return { id: updated.id, role: updated.role, userId: updated.userId };
  },

  async removeMember(tenant: TenantContext, memberId: string) {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId: tenant.workspaceId },
    });
    if (!member) throw Errors.notFound("Member not found");
    const self = member.userId === tenant.userId;
    if (!self && !canManageRole(tenant.role, member.role)) throw Errors.forbidden();
    await assertLastOwnerSafe(tenant.workspaceId, member.userId);
    await prisma.projectMember.deleteMany({ where: { workspaceId: tenant.workspaceId, userId: member.userId } });
    await prisma.workspaceMember.delete({ where: { id: member.id } });
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "member",
      entityId: member.userId,
      action: AUDIT_ACTIONS.MEMBER_REMOVED,
      metadata: { self },
    });
  },

  async invite(tenant: TenantContext, input: InviteMemberInput) {
    if (!canManageRole(tenant.role, input.role)) throw Errors.forbidden("You cannot invite that role");
    const email = input.email.toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const already = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: tenant.workspaceId, userId: existingUser.id } },
      });
      if (already) throw Errors.conflict("That person is already in the workspace");
    }
    await assertCanAdd(tenant.workspaceId, "members");
    const token = randomToken(32);
    const invitation = await prisma.invitation.create({
      data: {
        workspaceId: tenant.workspaceId,
        email,
        role: input.role,
        tokenHash: sha256(token),
        invitedById: tenant.userId,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    const [workspace, actor] = await Promise.all([
      prisma.workspace.findUniqueOrThrow({ where: { id: tenant.workspaceId } }),
      prisma.user.findUniqueOrThrow({ where: { id: tenant.userId } }),
    ]);
    await sendEmail({
      to: email,
      subject: `Join ${workspace.name} on Flowboard`,
      text: `${actor.name} invited you to ${workspace.name} as ${input.role}.\n\nAccept the invitation:\n${env.APP_URL}/invite?token=${token}\n\nThis link expires in ${INVITE_DAYS} days.`,
    });
    if (existingUser) {
      await notifyUsers({
        workspaceId: tenant.workspaceId,
        userIds: [existingUser.id],
        type: "PROJECT_INVITATION",
        title: `Invitation to ${workspace.name}`,
        body: `You were invited to join ${workspace.name}.`,
        link: `/invite?token=${token}`,
        metadata: { invitationId: invitation.id },
      });
    }
    await recordActivity({
      workspaceId: tenant.workspaceId,
      actorId: tenant.userId,
      entityType: "member",
      entityId: invitation.id,
      action: AUDIT_ACTIONS.MEMBER_INVITED,
      metadata: { email, role: input.role },
    });
    return { id: invitation.id, email, role: invitation.role, status: invitation.status, expiresAt: invitation.expiresAt };
  },

  async listInvitations(tenant: TenantContext) {
    const invitations = await prisma.invitation.findMany({
      where: { workspaceId: tenant.workspaceId },
      include: { invitedBy: { select: userSelect } },
      orderBy: { createdAt: "desc" },
    });
    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.expiresAt.getTime() < Date.now() && invitation.status === "PENDING" ? "EXPIRED" : invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      invitedBy: presentUser(invitation.invitedBy),
    }));
  },

  async resendInvitation(tenant: TenantContext, invitationId: string) {
    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, workspaceId: tenant.workspaceId },
    });
    if (!invitation || invitation.status !== "PENDING") throw Errors.notFound("Invitation not found");
    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { tokenHash: sha256(token), expiresAt },
    });
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: tenant.workspaceId } });
    await sendEmail({
      to: invitation.email,
      subject: `Join ${workspace.name} on Flowboard`,
      text: `Your invitation was resent.\n${env.APP_URL}/invite?token=${token}\n\nThis link expires in ${INVITE_DAYS} days.`,
    });
    return { id: invitation.id, expiresAt };
  },

  async cancelInvitation(tenant: TenantContext, invitationId: string) {
    const result = await prisma.invitation.updateMany({
      where: { id: invitationId, workspaceId: tenant.workspaceId, status: "PENDING" },
      data: { status: "REVOKED" },
    });
    if (result.count === 0) throw Errors.notFound("Invitation not found");
  },

  async previewInvitation(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { workspace: true },
    });
    if (!invitation) throw Errors.notFound("Invitation not found");
    const expired = invitation.expiresAt.getTime() < Date.now();
    return {
      workspaceName: invitation.workspace.name,
      role: invitation.role,
      emailMasked: maskEmail(invitation.email),
      status: expired && invitation.status === "PENDING" ? "EXPIRED" : invitation.status,
    };
  },

  async acceptInvitation(userId: string, token: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const invitation = await prisma.invitation.findUnique({ where: { tokenHash: sha256(token) } });
    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt.getTime() < Date.now()) {
      throw Errors.badRequest("This invitation is invalid or expired");
    }
    if (invitation.email !== user.email.toLowerCase()) {
      throw Errors.forbidden("Sign in with the invited email address to accept");
    }
    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
    });
    if (!existing) {
      const members = await prisma.workspaceMember.count({ where: { workspaceId: invitation.workspaceId } });
      const subscription = await prisma.subscription.findUnique({
        where: { workspaceId: invitation.workspaceId },
        include: { plan: true },
      });
      if (subscription?.plan.maxMembers != null && members >= subscription.plan.maxMembers) {
        throw Errors.planLimit(`The ${subscription.plan.name} plan is at its member limit.`);
      }
      await prisma.workspaceMember.create({
        data: { workspaceId: invitation.workspaceId, userId, role: invitation.role },
      });
    }
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    return { workspaceId: invitation.workspaceId };
  },
};
