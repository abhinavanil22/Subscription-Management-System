import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { forbidden, unauthorized } from "../utils/errors";
import type { Role } from "../../../shared/constants";

export interface AuthUser { id: string; role: Role }
declare global { namespace Express { interface Request { user?: AuthUser } } }

export const signToken = (u: AuthUser) => jwt.sign({ sub: u.id, role: u.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) throw unauthorized();
  try {
    const p = jwt.verify(h.slice(7), config.jwtSecret) as any;
    req.user = { id: p.sub, role: p.role };
    next();
  } catch { throw unauthorized("Invalid or expired token"); }
}
export const requireRole = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) throw forbidden();
  next();
};
