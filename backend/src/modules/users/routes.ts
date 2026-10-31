// OWNER: Member 1
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../db";
import { PASSWORD_RULE } from "../../../../shared/constants";
import { requireAuth, requireRole } from "../../middleware/auth";
import { conflict } from "../../utils/errors";
import { ok } from "../../utils/response";

const r = Router();
r.use(requireAuth, requireRole("ADMIN"));
r.post("/staff", async (req, res) => { // only admin can add staff
  const b = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().regex(PASSWORD_RULE) }).parse(req.body);
  const email = b.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw conflict("Email already registered");
  const u = await prisma.user.create({ data: { email, name: b.name, role: "STAFF", passwordHash: await bcrypt.hash(b.password, 10) } });
  ok(res, { id: u.id, email, name: u.name, role: u.role }, 201);
});
// TODO(M1): GET /users, PATCH /users/:id (deactivate)
export default r;
