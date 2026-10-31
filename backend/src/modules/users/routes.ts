// OWNER: Member 1
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../db";
import { PASSWORD_RULE } from "../../../../shared/constants";
import { requireAuth, requireRole } from "../../middleware/auth";
import { badRequest, conflict, notFound } from "../../utils/errors";
import { ok, paging } from "../../utils/response";

const r = Router();
r.use(requireAuth, requireRole("ADMIN"));

// POST /users/staff (only admin can add staff)
r.post("/staff", async (req, res) => {
  const b = z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().regex(PASSWORD_RULE),
    })
    .parse(req.body);

  const email = b.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    throw conflict("Email already registered");
  }

  const u = await prisma.user.create({
    data: {
      email,
      name: b.name,
      role: "STAFF",
      passwordHash: await bcrypt.hash(b.password, 10),
    },
  });

  ok(res, { id: u.id, email: u.email, name: u.name, role: u.role }, 201);
});

// GET /users (ADMIN)
r.get("/", async (req, res) => {
  const { page, limit, skip, take } = paging(req.query);
  const role = typeof req.query.role === "string" ? req.query.role : undefined;

  const where: any = {};
  if (role) where.role = role;

  const [total, data] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
  ]);

  ok(res, data, 200, { page, limit, total });
});

// PATCH /users/:id (ADMIN)
r.patch("/:id", async (req, res) => {
  const { isActive, role } = z
    .object({
      isActive: z.boolean().optional(),
      role: z.enum(["ADMIN", "STAFF", "CUSTOMER"]).optional(),
    })
    .parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw notFound("User not found");

  if (user.id === req.user!.id && isActive === false) {
    throw badRequest("Cannot deactivate your own account");
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(role !== undefined ? { role } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  ok(res, updated);
});

export default r;
