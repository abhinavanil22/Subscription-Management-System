// OWNER: Member 2  -- TODO: implement; routes below are the agreed contract (see docs/CONTRACT.md)
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { notImplemented } from "../../utils/errors";
const r = Router(); r.use(requireAuth);
r.get("/", requireRole("ADMIN","STAFF"), notImplemented);
r.post("/", requireRole("ADMIN"), notImplemented);
r.get("/:id", requireRole("ADMIN","STAFF"), notImplemented);
r.patch("/:id", requireRole("ADMIN"), notImplemented);
export default r;
