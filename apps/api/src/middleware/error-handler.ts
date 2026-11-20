import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "File exceeds the 10 MB limit" : error.message;
    res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    res.status(409).json({ error: { code: "CONFLICT", message: "That value is already in use" } });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: {
      code: "INTERNAL",
      message: "Something went wrong",
      details: env.isProduction ? undefined : error instanceof Error ? error.message : undefined,
    },
  });
}
