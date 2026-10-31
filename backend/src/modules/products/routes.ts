// OWNER: Member 1
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { notFound } from "../../utils/errors";
import { ok, paging } from "../../utils/response";

const r = Router();
r.use(requireAuth);

const productTypeEnum = z.enum(["SERVICE", "GOODS"]);

const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: productTypeEnum,
  salesPrice: z.number().min(0, "Sales price cannot be negative"),
  costPrice: z.number().min(0, "Cost price cannot be negative"),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  type: productTypeEnum.optional(),
  salesPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createVariantSchema = z.object({
  attribute: z.string().min(1, "Attribute is required"),
  value: z.string().min(1, "Value is required"),
  priceAdjustment: z.number().default(0),
});

const updateVariantSchema = z.object({
  attribute: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  priceAdjustment: z.number().optional(),
});

// GET /products (ADMIN, STAFF)
r.get("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const { page, limit, skip, take } = paging(req.query);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const isActive =
    req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;

  const where: any = {};
  if (search) where.name = { contains: search };
  if (type) where.type = type;
  if (isActive !== undefined) where.isActive = isActive;

  const [total, data] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        variants: true,
      },
    }),
  ]);

  ok(res, data, 200, { page, limit, total });
});

// POST /products (ADMIN)
r.post("/", requireRole("ADMIN"), async (req, res) => {
  const body = createProductSchema.parse(req.body);

  const product = await prisma.product.create({
    data: {
      name: body.name.trim(),
      type: body.type,
      salesPrice: body.salesPrice,
      costPrice: body.costPrice,
      notes: body.notes?.trim() ?? null,
      isActive: body.isActive ?? true,
    },
    include: {
      variants: true,
    },
  });

  ok(res, product, 201);
});

// GET /products/:id (ADMIN, STAFF)
r.get("/:id", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: {
      variants: true,
    },
  });

  if (!product) throw notFound("Product not found");

  ok(res, product);
});

// PATCH /products/:id (ADMIN)
r.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const body = updateProductSchema.parse(req.body);

  const existing = await prisma.product.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) throw notFound("Product not found");

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.salesPrice !== undefined ? { salesPrice: body.salesPrice } : {}),
      ...(body.costPrice !== undefined ? { costPrice: body.costPrice } : {}),
      ...(body.notes !== undefined ? { notes: body.notes?.trim() ?? null } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: {
      variants: true,
    },
  });

  ok(res, product);
});

// DELETE /products/:id (ADMIN)
r.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const existing = await prisma.product.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) throw notFound("Product not found");

  // Delete product variants and soft-delete/delete product
  await prisma.$transaction([
    prisma.productVariant.deleteMany({ where: { productId: req.params.id } }),
    prisma.product.delete({ where: { id: req.params.id } }),
  ]);

  ok(res, { message: "Product deleted" });
});

// POST /products/:id/variants (ADMIN)
r.post("/:id/variants", requireRole("ADMIN"), async (req, res) => {
  const body = createVariantSchema.parse(req.body);

  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
  });
  if (!product) throw notFound("Product not found");

  const variant = await prisma.productVariant.create({
    data: {
      productId: req.params.id,
      attribute: body.attribute.trim(),
      value: body.value.trim(),
      priceAdjustment: body.priceAdjustment,
    },
  });

  ok(res, variant, 201);
});

// PATCH /products/:id/variants/:variantId (ADMIN)
r.patch("/:id/variants/:variantId", requireRole("ADMIN"), async (req, res) => {
  const body = updateVariantSchema.parse(req.body);

  const variant = await prisma.productVariant.findFirst({
    where: { id: req.params.variantId, productId: req.params.id },
  });
  if (!variant) throw notFound("Variant not found");

  const updated = await prisma.productVariant.update({
    where: { id: req.params.variantId },
    data: {
      ...(body.attribute !== undefined ? { attribute: body.attribute.trim() } : {}),
      ...(body.value !== undefined ? { value: body.value.trim() } : {}),
      ...(body.priceAdjustment !== undefined ? { priceAdjustment: body.priceAdjustment } : {}),
    },
  });

  ok(res, updated);
});

// DELETE /products/:id/variants/:variantId (ADMIN)
r.delete("/:id/variants/:variantId", requireRole("ADMIN"), async (req, res) => {
  const variant = await prisma.productVariant.findFirst({
    where: { id: req.params.variantId, productId: req.params.id },
  });
  if (!variant) throw notFound("Variant not found");

  await prisma.productVariant.delete({
    where: { id: req.params.variantId },
  });

  ok(res, { message: "Variant deleted" });
});

export default r;
