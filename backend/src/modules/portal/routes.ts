// OWNER: Member 3  -- TODO: implement; routes below are the agreed contract (see docs/CONTRACT.md)
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { notImplemented } from "../../utils/errors";
const r = Router(); r.use(requireAuth);
r.get("/subscriptions", requireRole("CUSTOMER"), notImplemented);
r.get("/subscriptions/:id", requireRole("CUSTOMER"), notImplemented);
r.get("/invoices", requireRole("CUSTOMER"), notImplemented);
r.get("/invoices/:id", requireRole("CUSTOMER"), notImplemented);
r.get("/payments", requireRole("CUSTOMER"), notImplemented);
export default r;
