// OWNER: Member 3  -- TODO: implement; routes below are the agreed contract (see docs/CONTRACT.md)
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { notImplemented } from "../../utils/errors";
const r = Router(); r.use(requireAuth);
r.get("/summary", requireRole("ADMIN","STAFF"), notImplemented);
r.get("/active-subscriptions", requireRole("ADMIN","STAFF"), notImplemented);
r.get("/revenue", requireRole("ADMIN","STAFF"), notImplemented);
r.get("/overdue-invoices", requireRole("ADMIN","STAFF"), notImplemented);
export default r;
