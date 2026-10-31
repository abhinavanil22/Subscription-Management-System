import { Request, Response } from "express";
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const badRequest = (m: string, d?: unknown) => new AppError(400, "VALIDATION_ERROR", m, d);
export const unauthorized = (m = "Unauthorized") => new AppError(401, "UNAUTHORIZED", m);
export const forbidden = (m = "Forbidden") => new AppError(403, "FORBIDDEN", m);
export const notFound = (m = "Not found") => new AppError(404, "NOT_FOUND", m);
export const conflict = (m: string) => new AppError(409, "CONFLICT", m);
// Placeholder handler for routes owned by a member but not built yet
export const notImplemented = (req: Request, _res: Response) => {
  throw new AppError(501, "NOT_IMPLEMENTED", `TODO: ${req.method} ${req.baseUrl}${req.path}`);
};
