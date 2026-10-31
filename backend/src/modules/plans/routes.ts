// OWNER: Member 1
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { badRequest, notFound } from "../../utils/errors";
import { ok, paging } from "../../utils/response";

const r = Router();
r.use(requireAuth);

const frequencyEnum = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
const planStatusEnum = z.enum(["ACTIVE", "PAUSED", "CLOSED"]);

const createPlanSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().min(0, "Price cannot be negative"),
  frequency: frequencyEnum,
  minQuantity: z.number().int().min(1).default(1),
  availableFrom: z.string().or(z.date()).transform((val) => new Date(val)),
  availableTo: z
    .string()
    .or(z.date())
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  status: planStatusEnum.optional().default("ACTIVE"),
  autoClose: z.boolean().optional().default(false),
  closable: z.boolean().optional().default(true),
  pausable: z.boolean().optional().default(true),
  renewable: z.boolean().optional().default(true),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  frequency: frequencyEnum.optional(),
  minQuantity: z.number().int().min(1).optional(),
  availableFrom: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  availableTo: z
    .string()
    .or(z.date())
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  status: planStatusEnum.optional(),
  autoClose: z.boolean().optional(),
  closable: z.boolean().optional(),
  pausable: z.boolean().optional(),
  renewable: z.boolean().optional(),
});

// GET /plans (ADMIN, STAFF)
r.get("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const { page, limit, skip, take } = paging(req.query);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const frequency = typeof req.query.frequency === "string" ? req.query.frequency : undefined;

  const where: any = {};
  if (search) where.name = { contains: search };
  if (status) where.status = status;
  if (frequency) where.frequency = frequency;

  const [total, data] = await Promise.all([
    prisma.plan.count({ where }),
    prisma.plan.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    }),
  ]);

  ok(res, data, 200, { page, limit, total });
});

// POST /plans (ADMIN)
r.post("/", requireRole("ADMIN"), async (req, res) => {
  const body = createPlanSchema.parse(req.body);

  if (body.availableTo && body.availableTo < body.availableFrom) {
    throw badRequest("availableTo cannot be before availableFrom");
  }

  const plan = await prisma.plan.create({
    data: {
      name: body.name.trim(),
      price: body.price,
      frequency: body.frequency,
      minQuantity: body.minQuantity,
      availableFrom: body.availableFrom,
      availableTo: body.availableTo,
      status: body.status,
      autoClose: body.autoClose,
      closable: body.closable,
      pausable: body.pausable,
      renewable: body.renewable,
    },
  });

  ok(res, plan, 201);
});

// GET /plans/:id (ADMIN, STAFF)
r.get("/:id", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const plan = await prisma.plan.findUnique({
    where: { id: req.params.id },
    include: {
      _count: {
        select: { subscriptions: true, templates: true },
      },
    },
  });

  if (!plan) throw notFound("Plan not found");

  ok(res, plan);
});

// PATCH /plans/:id (ADMIN)
r.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const body = updatePlanSchema.parse(req.body);

  const existing = await prisma.plan.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) throw notFound("Plan not found");

  const from = body.availableFrom ?? existing.availableFrom;
  const to = body.availableTo !== undefined ? body.availableTo : existing.availableTo;
  if (to && to < from) {
    throw badRequest("availableTo cannot be before availableFrom");
  }

  const updated = await prisma.plan.update({
    where: { id: req.params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.price !== undefined ? { price: body.price } : {}),
      ...(body.frequency !== undefined ? { frequency: body.frequency } : {}),
      ...(body.minQuantity !== undefined ? { minQuantity: body.minQuantity } : {}),
      ...(body.availableFrom !== undefined ? { availableFrom: body.availableFrom } : {}),
      ...(body.availableTo !== undefined ? { availableTo: body.availableTo } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.autoClose !== undefined ? { autoClose: body.autoClose } : {}),
      ...(body.closable !== undefined ? { closable: body.closable } : {}),
      ...(body.pausable !== undefined ? { pausable: body.pausable } : {}),
      ...(body.renewable !== undefined ? { renewable: body.renewable } : {}),
    },
  });

  ok(res, updated);
});

// POST /plans/:id/close (ADMIN)
r.post("/:id/close", requireRole("ADMIN"), async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!plan) throw notFound("Plan not found");
  if (!plan.closable) throw badRequest("This plan cannot be closed");

  const updated = await prisma.plan.update({
    where: { id: req.params.id },
    data: { status: "CLOSED" },
  });

  ok(res, updated);
});

// POST /plans/:id/pause (ADMIN)
r.post("/:id/pause", requireRole("ADMIN"), async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!plan) throw notFound("Plan not found");
  if (!plan.pausable) throw badRequest("This plan cannot be paused");

  const updated = await prisma.plan.update({
    where: { id: req.params.id },
    data: { status: "PAUSED" },
  });

  ok(res, updated);
});

// POST /plans/:id/renew (ADMIN)
r.post("/:id/renew", requireRole("ADMIN"), async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
  if (!plan) throw notFound("Plan not found");
  if (!plan.renewable) throw badRequest("This plan cannot be renewed");

  const updated = await prisma.plan.update({
    where: { id: req.params.id },
    data: { status: "ACTIVE" },
  });

  ok(res, updated);
});

export default r;
