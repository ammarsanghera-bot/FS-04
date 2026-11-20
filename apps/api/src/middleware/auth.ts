import type { NextFunction, Request, Response } from "express";
import { Errors } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { asyncHandler } from "./async-handler.js";

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) throw Errors.unauthorized();
  const claims = verifyAccessToken(header.slice(7));
  const user = await prisma.user.findFirst({
    where: { id: claims.sub, deletedAt: null },
    select: { id: true, email: true, name: true },
  });
  if (!user) throw Errors.unauthorized("Account not found");
  req.user = user;
  next();
});

export const REFRESH_COOKIE = "fb_refresh";
