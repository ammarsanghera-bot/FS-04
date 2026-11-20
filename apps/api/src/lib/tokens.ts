import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { Errors } from "./errors.js";
import { prisma } from "./prisma.js";
import { randomToken, sha256 } from "./crypto.js";

export interface AccessClaims {
  sub: string;
}

export function signAccessToken(userId: string) {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
    issuer: "flowboard",
    audience: "flowboard-api",
  };
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: "flowboard",
      audience: "flowboard-api",
    });
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw new Error("Invalid access token");
    }
    return { sub: payload.sub };
  } catch {
    throw Errors.unauthorized("Invalid or expired session");
  }
}

export async function createRefreshToken(input: { userId: string; userAgent?: string; ip?: string }) {
  const raw = randomToken(48);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: {
      userId: input.userId,
      tokenHash: sha256(raw),
      expiresAt,
      userAgent: input.userAgent?.slice(0, 300),
      ip: input.ip?.slice(0, 80),
    },
  });
  return raw;
}

export async function rotateRefreshToken(raw: string, meta: { userAgent?: string; ip?: string }) {
  const tokenHash = sha256(raw);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing || existing.revokedAt || existing.expiresAt.getTime() < Date.now()) {
    throw Errors.unauthorized("Refresh session is no longer valid");
  }
  await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  const refreshToken = await createRefreshToken({ userId: existing.userId, ...meta });
  const accessToken = signAccessToken(existing.userId);
  return { userId: existing.userId, accessToken, refreshToken };
}

export async function revokeRefreshToken(raw: string) {
  const tokenHash = sha256(raw);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshTokens(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
