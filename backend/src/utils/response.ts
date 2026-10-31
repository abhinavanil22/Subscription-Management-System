import { Response } from "express";
export const ok = <T>(res: Response, data: T, status = 200, meta?: object) => res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
// Pagination: ?page=1&limit=20 (max 100)
export const paging = (q: any) => {
  const page = Math.max(1, Number(q.page) || 1), limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
};
