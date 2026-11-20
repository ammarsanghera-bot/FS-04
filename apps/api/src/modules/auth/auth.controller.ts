import type { Request, Response } from "express";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from "@flowboard/shared";
import { env } from "../../config/env.js";
import { parseOrThrow } from "../../lib/errors.js";
import { REFRESH_COOKIE } from "../../middleware/auth.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { authService } from "./auth.service.js";

function meta(req: Request) {
  return { userAgent: req.get("user-agent") ?? undefined, ip: req.ip };
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
}

function sendSession(res: Response, session: { accessToken: string; refreshToken: string; user: unknown; workspaces: unknown }) {
  setRefreshCookie(res, session.refreshToken);
  res.json({ accessToken: session.accessToken, user: session.user, workspaces: session.workspaces });
}

export const register = asyncHandler(async (req, res) => {
  const session = await authService.register(parseOrThrow(registerSchema, req.body), meta(req));
  res.status(201);
  sendSession(res, session);
});

export const login = asyncHandler(async (req, res) => {
  sendSession(res, await authService.login(parseOrThrow(loginSchema, req.body), meta(req)));
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
  clearRefreshCookie(res);
  res.status(204).end();
});

export const refresh = asyncHandler(async (req, res) => {
  sendSession(res, await authService.refresh(req.cookies?.[REFRESH_COOKIE] as string | undefined, meta(req)));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const body = parseOrThrow(forgotPasswordSchema, req.body);
  await authService.forgotPassword(body.email);
  res.json({ message: "If an account exists for that email, a reset link is on the way." });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(parseOrThrow(resetPasswordSchema, req.body));
  res.json({ message: "Password updated. Sign in with the new password." });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const body = parseOrThrow(verifyEmailSchema, req.body);
  await authService.verifyEmail(body.token);
  res.json({ message: "Email verified." });
});

export const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.user!.id);
  res.json({ message: "Verification email sent." });
});

export const me = asyncHandler(async (req, res) => {
  res.json(await authService.me(req.user!.id));
});

export const updateProfile = asyncHandler(async (req, res) => {
  res.json({ user: await authService.updateProfile(req.user!.id, parseOrThrow(updateProfileSchema, req.body)) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const session = await authService.changePassword(req.user!.id, parseOrThrow(changePasswordSchema, req.body), meta(req));
  sendSession(res, session);
});

export const listSessions = asyncHandler(async (req, res) => {
  res.json({ sessions: await authService.listSessions(req.user!.id, req.cookies?.[REFRESH_COOKIE] as string | undefined) });
});

export const revokeSession = asyncHandler(async (req, res) => {
  const sessionId = String(req.params.sessionId);
  await authService.revokeSession(req.user!.id, sessionId);
  res.status(204).end();
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Choose an image" } });
    return;
  }
  res.json(await authService.saveAvatar(req.user!.id, req.file));
});

export const getAvatar = asyncHandler(async (req, res) => {
  const stream = await authService.openAvatar(req.user!.id, String(req.params.userId));
  res.setHeader("Cache-Control", "private, max-age=3600");
  stream.on("error", () => {
    if (!res.headersSent) res.status(404).json({ error: { code: "NOT_FOUND", message: "Avatar not found" } });
  });
  stream.pipe(res);
});
