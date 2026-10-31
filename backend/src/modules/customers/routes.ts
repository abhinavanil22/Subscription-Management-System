// OWNER: Member 1
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { notFound } from "../../utils/errors";
import { ok, paging } from "../../utils/response";

const r = Router();
r.use(requireAuth);

const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
});

// GET /customers (ADMIN, STAFF)
r.get("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const { page, limit, skip, take } = paging(req.query);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { company: { contains: search } },
        ],
      }
    : {};

  const [total, data] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            subscriptions: true,
            invoices: true,
          },
        },
      },
    }),
  ]);

  ok(res, data, 200, { page, limit, total });
});

// POST /customers (ADMIN, STAFF)
r.post("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const body = createCustomerSchema.parse(req.body);

  const customer = await prisma.customer.create({
    data: {
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      phone: body.phone?.trim() ?? null,
      address: body.address?.trim() ?? null,
      company: body.company?.trim() ?? null,
    },
  });

  ok(res, customer, 201);
});

// GET /customers/:id (ADMIN, STAFF)
r.get("/:id", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          plan: { select: { name: true, frequency: true } },
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: {
        select: {
          subscriptions: true,
          invoices: true,
        },
      },
    },
  });

  if (!customer) throw notFound("Customer not found");

  ok(res, customer);
});

// PATCH /customers/:id (ADMIN, STAFF)
r.patch("/:id", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const body = updateCustomerSchema.parse(req.body);

  const existing = await prisma.customer.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) throw notFound("Customer not found");

  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.email !== undefined ? { email: body.email.toLowerCase().trim() } : {}),
      ...(body.phone !== undefined ? { phone: body.phone?.trim() ?? null } : {}),
      ...(body.address !== undefined ? { address: body.address?.trim() ?? null } : {}),
      ...(body.company !== undefined ? { company: body.company?.trim() ?? null } : {}),
    },
  });

  ok(res, customer);
});

export default r;
