
import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { badRequest, notFound } from "../../utils/errors";
import { ok, paging } from "../../utils/response";

const r = Router();
r.use(requireAuth);

const lineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional().nullable(),
  quantity: z.number().int().positive()
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  planId: z.string().min(1),
  validityDays: z.number().int().positive().max(3650).default(30),
  lines: z.array(lineSchema).min(1)
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  planId: z.string().min(1).optional(),
  validityDays: z.number().int().positive().max(3650).optional(),
  lines: z.array(lineSchema).min(1).optional()
}).refine(
  data => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

async function validatePlan(planId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId }
  });

  if (!plan) throw notFound("Plan not found");
}

async function validateLines(
  lines: z.infer<typeof lineSchema>[]
) {
  for (const line of lines) {
    const product = await prisma.product.findUnique({
      where: { id: line.productId }
    });

    if (!product) {
      throw badRequest(`Product ${line.productId} does not exist`);
    }

    if (!product.isActive) {
      throw badRequest(`Product ${product.name} is inactive`);
    }

    if (line.variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: line.variantId }
      });

      if (!variant || variant.productId !== line.productId) {
        throw badRequest(
          `Invalid variant for product ${line.productId}`
        );
      }
    }
  }
}

// GET /api/v1/quotation-templates
r.get("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const { page, limit, skip, take } = paging(req.query);

  const where: Prisma.QuotationTemplateWhereInput = {};

  if (typeof req.query.planId === "string") {
    where.planId = req.query.planId;
  }

  const [templates, total] = await Promise.all([
    prisma.quotationTemplate.findMany({
      where,
      skip,
      take,
      include: {
        plan: true,
        lines: true
      },
      orderBy: { name: "asc" }
    }),
    prisma.quotationTemplate.count({ where })
  ]);

  return ok(res, templates, 200, { page, limit, total });
});

// POST /api/v1/quotation-templates
r.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);

  if (!parsed.success) {
    throw badRequest(
      "Invalid quotation template",
      parsed.error.flatten()
    );
  }

  const { name, planId, validityDays, lines } = parsed.data;

  await validatePlan(planId);
  await validateLines(lines);

  const template = await prisma.quotationTemplate.create({
    data: {
      name,
      planId,
      validityDays,
      lines: {
        create: lines.map(line => ({
          productId: line.productId,
          variantId: line.variantId ?? null,
          quantity: line.quantity
        }))
      }
    },
    include: {
      plan: true,
      lines: true
    }
  });

  return ok(res, template, 201);
});

// GET /api/v1/quotation-templates/:id
r.get("/:id", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const template = await prisma.quotationTemplate.findUnique({
    where: { id: req.params.id },
    include: {
      plan: true,
      lines: true
    }
  });

  if (!template) {
    throw notFound("Quotation template not found");
  }

  return ok(res, template);
});

// PATCH /api/v1/quotation-templates/:id
r.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);

  if (!parsed.success) {
    throw badRequest(
      "Invalid quotation template update",
      parsed.error.flatten()
    );
  }

  const existing = await prisma.quotationTemplate.findUnique({
    where: { id: req.params.id }
  });

  if (!existing) {
    throw notFound("Quotation template not found");
  }

  const updates = parsed.data;

  if (updates.planId) {
    await validatePlan(updates.planId);
  }

  if (updates.lines) {
    await validateLines(updates.lines);
  }

  const data: Prisma.QuotationTemplateUpdateInput = {};

  if (updates.name !== undefined) {
    data.name = updates.name;
  }

  if (updates.planId !== undefined) {
    data.plan = { connect: { id: updates.planId } };
  }

  if (updates.validityDays !== undefined) {
    data.validityDays = updates.validityDays;
  }

  if (updates.lines !== undefined) {
    data.lines = {
      deleteMany: {},
      create: updates.lines.map(line => ({
        productId: line.productId,
        variantId: line.variantId ?? null,
        quantity: line.quantity
      }))
    };
  }

  const template = await prisma.quotationTemplate.update({
    where: { id: req.params.id },
    data,
    include: {
      plan: true,
      lines: true
    }
  });

  return ok(res, template);
});

export default r;
