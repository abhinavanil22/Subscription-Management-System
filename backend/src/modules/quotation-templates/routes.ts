<<<<<<< Updated upstream

import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
=======
// OWNER: Member 2
import { Router } from "express";
import { z } from "zod";
>>>>>>> Stashed changes
import { prisma } from "../../db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { badRequest, notFound } from "../../utils/errors";
import { ok, paging } from "../../utils/response";

const r = Router();
r.use(requireAuth);

<<<<<<< Updated upstream
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
=======
const lineInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  planId: z.string().min(1, "Plan ID is required"),
  validityDays: z.number().int().min(1).default(30),
  lines: z.array(lineInputSchema).optional().default([]),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  planId: z.string().min(1).optional(),
  validityDays: z.number().int().min(1).optional(),
  lines: z.array(lineInputSchema).optional(),
});

// GET /quotation-templates (ADMIN, STAFF)
r.get("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const { page, limit, skip, take } = paging(req.query);
  const planId = typeof req.query.planId === "string" ? req.query.planId : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;

  const where: any = {};
  if (planId) where.planId = planId;
  if (search) where.name = { contains: search };

  const [total, data] = await Promise.all([
    prisma.quotationTemplate.count({ where }),
>>>>>>> Stashed changes
    prisma.quotationTemplate.findMany({
      where,
      skip,
      take,
<<<<<<< Updated upstream
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
=======
      orderBy: { name: "asc" },
      include: {
        plan: true,
        lines: true,
      },
    }),
  ]);

  ok(res, data, 200, { page, limit, total });
});

// POST /quotation-templates (ADMIN)
r.post("/", requireRole("ADMIN"), async (req, res) => {
  const body = createTemplateSchema.parse(req.body);

  const plan = await prisma.plan.findUnique({ where: { id: body.planId } });
  if (!plan) throw badRequest("Referenced plan does not exist");

  const template = await prisma.$transaction(async (tx) => {
    const created = await tx.quotationTemplate.create({
      data: {
        name: body.name.trim(),
        planId: body.planId,
        validityDays: body.validityDays,
        lines: {
          create: body.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId ?? null,
            quantity: l.quantity,
          })),
        },
      },
      include: {
        plan: true,
        lines: true,
      },
    });
    return created;
  });

  ok(res, template, 201);
});

// GET /quotation-templates/:id (ADMIN, STAFF)
>>>>>>> Stashed changes
r.get("/:id", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const template = await prisma.quotationTemplate.findUnique({
    where: { id: req.params.id },
    include: {
      plan: true,
<<<<<<< Updated upstream
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
=======
      lines: true,
    },
  });

  if (!template) throw notFound("Quotation template not found");

  ok(res, template);
});

// PATCH /quotation-templates/:id (ADMIN)
r.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const body = updateTemplateSchema.parse(req.body);

  const existing = await prisma.quotationTemplate.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) throw notFound("Quotation template not found");

  if (body.planId) {
    const plan = await prisma.plan.findUnique({ where: { id: body.planId } });
    if (!plan) throw badRequest("Referenced plan does not exist");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (body.lines) {
      await tx.quotationTemplateLine.deleteMany({
        where: { templateId: req.params.id },
      });
      await tx.quotationTemplateLine.createMany({
        data: body.lines.map((l) => ({
          templateId: req.params.id,
          productId: l.productId,
          variantId: l.variantId ?? null,
          quantity: l.quantity,
        })),
      });
    }

    return tx.quotationTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.planId !== undefined ? { planId: body.planId } : {}),
        ...(body.validityDays !== undefined ? { validityDays: body.validityDays } : {}),
      },
      include: {
        plan: true,
        lines: true,
      },
    });
  });

  ok(res, updated);
>>>>>>> Stashed changes
});

export default r;
