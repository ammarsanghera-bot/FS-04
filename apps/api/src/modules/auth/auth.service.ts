import { PLAN_IDS } from "@flowboard/shared";
import type { ChangePasswordInput, LoginInput, RegisterInput, ResetPasswordInput, UpdateProfileInput } from "@flowboard/shared";
import { env } from "../../config/env.js";
import { randomToken, sha256 } from "../../lib/crypto.js";
import { sendEmail } from "../../lib/email.js";
import { Errors } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { presentUser, userSelect } from "../../lib/presenters.js";
import { prisma } from "../../lib/prisma.js";
import { uniqueSlug } from "../../lib/slug.js";
import { storage } from "../../lib/storage.js";
import { createRefreshToken, revokeAllRefreshTokens, revokeRefreshToken, rotateRefreshToken, signAccessToken } from "../../lib/tokens.js";

const DAY = 24 * 60 * 60 * 1000;

async function workspacesFor(userId: string) {
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
  }));
}

async function issue(userId: string, meta: { userAgent?: string; ip?: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
  return {
    accessToken: signAccessToken(userId),
    refreshToken: await createRefreshToken({ userId, ...meta }),
    user: presentUser(user),
    workspaces: await workspacesFor(userId),
  };
}

async function createEmailToken(userId: string) {
  const token = randomToken(32);
  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 2 * DAY) },
  });
  return token;
}

export const authService = {
  async register(input: RegisterInput, meta: { userAgent?: string; ip?: string }) {
    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw Errors.conflict("An account with that email already exists");

    const passwordHash = await hashPassword(input.password);
    const slug = await uniqueSlug(input.workspaceName);
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email.toLowerCase(), name: input.name.trim(), passwordHash },
      });
      const workspace = await tx.workspace.create({ data: { name: input.workspaceName.trim(), slug } });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
      });
      await tx.subscription.create({
        data: { workspaceId: workspace.id, planId: PLAN_IDS.FREE, status: "ACTIVE" },
      });
      await tx.activityLog.create({
        data: {
          workspaceId: workspace.id,
          actorId: user.id,
          entityType: "workspace",
          entityId: workspace.id,
          action: "workspace.created",
          metadata: { name: workspace.name },
        },
      });
      return user;
    });

    const token = await createEmailToken(created.id);
    await sendEmail({
      to: created.email,
      subject: "Verify your Flowboard email",
      text: `Confirm your email for Flowboard:\n${env.APP_URL}/verify-email?token=${token}\n\nThis link expires in 48 hours.`,
    });
    return issue(created.id, meta);
  },

  async login(input: LoginInput, meta: { userAgent?: string; ip?: string }) {
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    const valid = await verifyPassword(input.password, user && !user.deletedAt ? user.passwordHash : null);
    if (!user || user.deletedAt || !valid) throw Errors.unauthorized("Email or password is incorrect");
    return issue(user.id, meta);
  },

  async logout(rawRefreshToken: string | undefined) {
    if (rawRefreshToken) await revokeRefreshToken(rawRefreshToken);
  },

  async refresh(rawRefreshToken: string | undefined, meta: { userAgent?: string; ip?: string }) {
    if (!rawRefreshToken) throw Errors.unauthorized("Refresh session is missing");
    const rotated = await rotateRefreshToken(rawRefreshToken, meta);
    const user = await prisma.user.findFirst({ where: { id: rotated.userId, deletedAt: null }, select: userSelect });
    if (!user) throw Errors.unauthorized("Account not found");
    return {
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      user: presentUser(user),
      workspaces: await workspacesFor(user.id),
    };
  },

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.deletedAt) return;
    const token = randomToken(32);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + DAY) },
    });
    await sendEmail({
      to: user.email,
      subject: "Reset your Flowboard password",
      text: `Reset your password:\n${env.APP_URL}/reset-password?token=${token}\n\nThis link expires in 24 hours. If you did not ask for it, ignore this email.`,
    });
  },

  async resetPassword(input: ResetPasswordInput) {
    const tokenHash = sha256(input.token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw Errors.badRequest("This reset link is invalid or expired");
    }
    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    await revokeAllRefreshTokens(record.userId);
  },

  async verifyEmail(token: string) {
    const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw Errors.badRequest("This verification link is invalid or expired");
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
      prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
  },

  async resendVerification(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return;
    const token = await createEmailToken(user.id);
    await sendEmail({
      to: user.email,
      subject: "Verify your Flowboard email",
      text: `Confirm your email for Flowboard:\n${env.APP_URL}/verify-email?token=${token}\n\nThis link expires in 48 hours.`,
    });
  },

  async me(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
    return { user: presentUser(user), workspaces: await workspacesFor(userId) };
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: input.name },
      select: userSelect,
    });
    return presentUser(user);
  },

  async changePassword(userId: string, input: ChangePasswordInput, meta: { userAgent?: string; ip?: string }) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) throw Errors.badRequest("Current password is incorrect");
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.newPassword) } });
    await revokeAllRefreshTokens(userId);
    return issue(userId, meta);
  },

  async listSessions(userId: string, currentToken?: string) {
    const currentHash = currentToken ? sha256(currentToken) : null;
    const sessions = await prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      current: session.tokenHash === currentHash,
    }));
  },

  async revokeSession(userId: string, sessionId: string) {
    const result = await prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw Errors.notFound("Session not found");
  },

  async saveAvatar(userId: string, file: Express.Multer.File) {
    if (!file.mimetype.startsWith("image/")) throw Errors.badRequest("Avatar must be an image");
    const existing = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const stored = await storage.save({ folder: `avatars/${userId}`, originalName: file.originalname, bytes: file.buffer });
    await prisma.user.update({ where: { id: userId }, data: { avatarKey: stored.storageKey } });
    if (existing.avatarKey) await storage.remove(existing.avatarKey).catch(() => undefined);
    return { avatarUrl: `/api/v1/auth/avatars/${userId}` };
  },

  async openAvatar(requesterId: string, targetUserId: string) {
    if (requesterId !== targetUserId) {
      const shared = await prisma.workspaceMember.findFirst({
        where: {
          userId: requesterId,
          workspace: { deletedAt: null, members: { some: { userId: targetUserId } } },
        },
      });
      if (!shared) throw Errors.forbidden("You cannot view this avatar");
    }
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user?.avatarKey) throw Errors.notFound("Avatar not found");
    return storage.open(user.avatarKey);
  },
};
