import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.flatten().fieldErrors } });
  if (err instanceof AppError) return res.status(err.status).json({ success: false, error: { code: err.code, message: err.message, details: err.details } });
  if (err?.code === "P2002") return res.status(409).json({ success: false, error: { code: "CONFLICT", message: "Duplicate value" } });
  console.error(err);
  res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}
