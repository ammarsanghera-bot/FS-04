import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(max: number, windowMs: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (env.isTest) return next();
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) return next(new AppError(429, "RATE_LIMITED", "Too many requests. Try again shortly."));
    return next();
  };
}
