// OWNER: Member 1
import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../../db";
import { PASSWORD_RULE } from "../../../../shared/constants";
import { requireAuth, signToken } from "../../middleware/auth";
import { badRequest, conflict, unauthorized } from "../../utils/errors";
import { ok } from "../../utils/response";

const r = Router();
const password = z.string().regex(PASSWORD_RULE, "Min 9 chars with uppercase, lowercase and special character");

r.post("/register", async (req, res) => { // public: creates a CUSTOMER user + Customer record
  const b = z.object({ name: z.string().min(1), email: z.string().email(), password }).parse(req.body);
  const email = b.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw conflict("Email already registered");
  const user = await prisma.user.create({
    data: { email, name: b.name, role: "CUSTOMER", passwordHash: await bcrypt.hash(b.password, 10),
      customer: { create: { name: b.name, email } } },
  });
  ok(res, { token: signToken({ id: user.id, role: "CUSTOMER" }), user: { id: user.id, email, name: user.name, role: user.role } }, 201);
});

r.post("/login", async (req, res) => {
  const b = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: b.email.toLowerCase() } });
  if (!user || !user.isActive || !(await bcrypt.compare(b.password, user.passwordHash))) throw unauthorized("Invalid credentials");
  ok(res, { token: signToken({ id: user.id, role: user.role as any }), user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

r.get("/me", requireAuth, async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true, name: true, role: true } });
  ok(res, u);
});

r.post("/forgot-password", async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt: new Date(Date.now() + 3600_000) } });
    console.log(`[DEV] Reset link: ${process.env.CLIENT_URL}/reset-password?token=${token}`); // TODO(M1): send real email
  }
  ok(res, { message: "If the email exists, a reset link has been sent" });
});

r.post("/reset-password", async (req, res) => {
  const b = z.object({ token: z.string(), password }).parse(req.body);
  const t = await prisma.passwordResetToken.findUnique({ where: { token: b.token } });
  if (!t || t.usedAt || t.expiresAt < new Date()) throw badRequest("Invalid or expired token");
  await prisma.$transaction([
    prisma.user.update({ where: { id: t.userId }, data: { passwordHash: await bcrypt.hash(b.password, 10) } }),
    prisma.passwordResetToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
  ]);
  ok(res, { message: "Password updated" });
});
export default r;
