import type { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  unauthorized: (message = "Authentication required") => new AppError(401, "UNAUTHORIZED", message),
  forbidden: (message = "You do not have permission to do that") => new AppError(403, "FORBIDDEN", message),
  notFound: (message = "Not found") => new AppError(404, "NOT_FOUND", message),
  conflict: (message: string) => new AppError(409, "CONFLICT", message),
  badRequest: (message: string, details?: unknown) => new AppError(400, "BAD_REQUEST", message, details),
  planLimit: (message: string) => new AppError(402, "PLAN_LIMIT", message),
  validation: (error: ZodError) => new AppError(400, "VALIDATION_ERROR", "Request validation failed", error.flatten()),
};

export function parseOrThrow<T>(schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: ZodError } }, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw Errors.validation(result.error);
  return result.data;
}
