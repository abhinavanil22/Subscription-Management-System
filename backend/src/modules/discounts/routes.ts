<<<<<<< Updated upstream

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { prisma } from "../../db";
import { requireAuth, requireRole } from "../../middleware/auth";
import {
  badRequest,
  notFound,
  conflict
} from "../../utils/errors";
import { ok, paging } from "../../utils/response";

const r = Router();

r.use(requireAuth);

// -------------------- VALIDATION --------------------

const discountFieldsSchema = z.object({
  name: z.string().trim().min(2).max(100),

  type: z.enum(["FIXED", "PERCENTAGE"]),

  value: z.number().finite().positive(),

  scope: z.enum(["PRODUCT", "SUBSCRIPTION"]),

  productId: z.string().nullable().optional(),

  subscriptionId: z.string().nullable().optional(),

  minPurchase: z.number().finite().min(0).nullable().optional(),

  minQuantity: z.number().int().positive().nullable().optional(),

  startDate: z.coerce.date(),

  endDate: z.coerce.date().nullable().optional(),

  usageLimit: z.number().int().positive().nullable().optional()
});

const discountSchema = discountFieldsSchema.superRefine((data, ctx) => {
  if (data.type === "PERCENTAGE" && data.value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "Percentage discount cannot exceed 100"
    });
  }

  if (data.scope === "PRODUCT" && !data.productId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["productId"],
      message: "Product ID is required for product discounts"
    });
  }

  if (data.scope === "SUBSCRIPTION" && data.productId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["productId"],
      message: "Product ID cannot be set for subscription discounts"
    });
  }

  if (data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End date cannot be before start date"
    });
  }
});

const updateDiscountSchema = discountFieldsSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

const listDiscountSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  type: z.enum(["FIXED", "PERCENTAGE"]).optional(),
  scope: z.enum(["PRODUCT", "SUBSCRIPTION"]).optional()
});
// -------------------- REFERENCE VALIDATION --------------------

async function validateReferences(
  scope: "PRODUCT" | "SUBSCRIPTION",
  productId?: string | null,
  subscriptionId?: string | null
) {
  if (scope === "PRODUCT") {
    if (!productId) {
      throw badRequest("Product ID is required for product discounts");
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true }
    });

    if (!product) {
      throw notFound("Product not found");
    }
  }

  if (scope === "SUBSCRIPTION" && productId) {
    throw badRequest(
      "Product ID cannot be set for subscription discounts"
    );
  }

  if (subscriptionId) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true }
    });

    if (!subscription) {
      throw notFound("Subscription not found");
    }
  }
}

function validateDates(startDate: Date, endDate?: Date | null) {
  if (endDate && endDate < startDate) {
    throw badRequest("End date cannot be before start date");
  }
}

// -------------------- GET ALL DISCOUNTS --------------------

r.get(
  "/",
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listDiscountSchema.safeParse(req.query);

      if (!parsed.success) {
        throw badRequest(
          "Invalid query parameters",
          parsed.error.flatten()
        );
      }

      const { page, limit, skip, take } = paging(parsed.data);
      const { search, type, scope } = parsed.data;

      const where = {
        ...(search
          ? { name: { contains: search } }
          : {}),
        ...(type ? { type } : {}),
        ...(scope ? { scope } : {})
      };

      const [discounts, total] = await Promise.all([
        prisma.discount.findMany({
          where,
          skip,
          take,
          orderBy: { startDate: "desc" }
        }),

        prisma.discount.count({ where })
      ]);

      return ok(res, discounts, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }
);

// -------------------- CREATE DISCOUNT --------------------

r.post(
  "/",
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = discountSchema.safeParse(req.body);

      if (!parsed.success) {
        throw badRequest(
          "Invalid discount details",
          parsed.error.flatten()
        );
      }

      const data = parsed.data;

      await validateReferences(
        data.scope,
        data.productId,
        data.subscriptionId
      );

      validateDates(data.startDate, data.endDate);

      const discount = await prisma.discount.create({
        data: {
          name: data.name,
          type: data.type,
          value: data.value,
          scope: data.scope,
          productId: data.productId,
          subscriptionId: data.subscriptionId,
          minPurchase: data.minPurchase,
          minQuantity: data.minQuantity,
          startDate: data.startDate,
          endDate: data.endDate,
          usageLimit: data.usageLimit
        }
      });

      return ok(res, discount, 201);
    } catch (error) {
      next(error);
    }
  }
);

// -------------------- UPDATE DISCOUNT --------------------

r.patch(
  "/:id",
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = z.string().min(1).safeParse(req.params.id);

      if (!id.success) {
        throw badRequest("Invalid discount ID");
      }

      const parsed = updateDiscountSchema.safeParse(req.body);

      if (!parsed.success) {
        throw badRequest(
          "Invalid discount details",
          parsed.error.flatten()
        );
      }

      const existing = await prisma.discount.findUnique({
        where: { id: id.data }
      });

      if (!existing) {
        throw notFound("Discount not found");
      }

      const data = parsed.data;

      const finalType = data.type ?? existing.type;
      const finalValue = data.value ?? existing.value;

      const finalScope = data.scope ?? existing.scope;

      const finalProductId =
        data.productId !== undefined
          ? data.productId
          : existing.productId;

      const finalSubscriptionId =
        data.subscriptionId !== undefined
          ? data.subscriptionId
          : existing.subscriptionId;

      const finalStartDate =
        data.startDate ?? existing.startDate;

      const finalEndDate =
        data.endDate !== undefined
          ? data.endDate
          : existing.endDate;

      if (finalType === "PERCENTAGE" && finalValue > 100) {
        throw badRequest(
          "Percentage discount cannot exceed 100"
        );
      }

      validateDates(finalStartDate, finalEndDate);

      await validateReferences(
        finalScope as "PRODUCT" | "SUBSCRIPTION",
        finalProductId,
        finalSubscriptionId
      );

      const updated = await prisma.discount.update({
        where: { id: id.data },
        data
      });

      return ok(res, updated);
    } catch (error) {
      next(error);
    }
  }
);

// -------------------- DELETE DISCOUNT --------------------

r.delete(
  "/:id",
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = z.string().min(1).safeParse(req.params.id);

      if (!id.success) {
        throw badRequest("Invalid discount ID");
      }

      const discount = await prisma.discount.findUnique({
        where: { id: id.data },
        include: {
          _count: {
            select: {
              invoices: true
            }
          }
        }
      });

      if (!discount) {
        throw notFound("Discount not found");
      }

      if (
        discount.usedCount > 0 ||
        discount._count.invoices > 0 ||
        discount.subscriptionId
      ) {
        throw conflict(
          "This discount has already been used or linked. It cannot be deleted."
        );
      }

      await prisma.discount.delete({
        where: { id: id.data }
      });

      return ok(res, {
        message: "Discount deleted successfully",
        id: id.data
      });
    } catch (error) {
      next(error);
    }
  }
);
=======
// OWNER: Member 2
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { badRequest, notFound } from "../../utils/errors";
import { ok, paging } from "../../utils/response";

const r = Router();
r.use(requireAuth);

const discountTypeEnum = z.enum(["FIXED", "PERCENTAGE"]);
const discountScopeEnum = z.enum(["PRODUCT", "SUBSCRIPTION"]);

const createDiscountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: discountTypeEnum,
  value: z.number().min(0, "Value cannot be negative"),
  scope: discountScopeEnum,
  productId: z.string().optional().nullable(),
  subscriptionId: z.string().optional().nullable(),
  minPurchase: z.number().min(0).optional().nullable(),
  minQuantity: z.number().int().min(1).optional().nullable(),
  startDate: z.string().or(z.date()).transform((val) => new Date(val)),
  endDate: z
    .string()
    .or(z.date())
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  usageLimit: z.number().int().min(1).optional().nullable(),
});

const updateDiscountSchema = z.object({
  name: z.string().min(1).optional(),
  type: discountTypeEnum.optional(),
  value: z.number().min(0).optional(),
  scope: discountScopeEnum.optional(),
  productId: z.string().optional().nullable(),
  subscriptionId: z.string().optional().nullable(),
  minPurchase: z.number().min(0).optional().nullable(),
  minQuantity: z.number().int().min(1).optional().nullable(),
  startDate: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .or(z.date())
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  usageLimit: z.number().int().min(1).optional().nullable(),
});

// GET /discounts (ADMIN, STAFF)
r.get("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const { page, limit, skip, take } = paging(req.query);
  const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;

  const where: any = {};
  if (scope) where.scope = scope;
  if (search) where.name = { contains: search };

  const [total, data] = await Promise.all([
    prisma.discount.count({ where }),
    prisma.discount.findMany({
      where,
      skip,
      take,
      orderBy: { startDate: "desc" },
    }),
  ]);

  ok(res, data, 200, { page, limit, total });
});

// POST /discounts (ADMIN)
r.post("/", requireRole("ADMIN"), async (req, res) => {
  const body = createDiscountSchema.parse(req.body);

  if (body.endDate && body.endDate < body.startDate) {
    throw badRequest("endDate cannot be before startDate");
  }

  if (body.scope === "PRODUCT" && !body.productId) {
    throw badRequest("productId is required when scope is PRODUCT");
  }

  if (body.type === "PERCENTAGE" && body.value > 100) {
    throw badRequest("Percentage discount cannot exceed 100%");
  }

  const discount = await prisma.discount.create({
    data: {
      name: body.name.trim(),
      type: body.type,
      value: body.value,
      scope: body.scope,
      productId: body.productId ?? null,
      subscriptionId: body.subscriptionId ?? null,
      minPurchase: body.minPurchase ?? null,
      minQuantity: body.minQuantity ?? null,
      startDate: body.startDate,
      endDate: body.endDate,
      usageLimit: body.usageLimit ?? null,
    },
  });

  ok(res, discount, 201);
});

// PATCH /discounts/:id (ADMIN)
r.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const body = updateDiscountSchema.parse(req.body);

  const existing = await prisma.discount.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) throw notFound("Discount not found");

  const start = body.startDate ?? existing.startDate;
  const end = body.endDate !== undefined ? body.endDate : existing.endDate;
  if (end && end < start) {
    throw badRequest("endDate cannot be before startDate");
  }

  const updated = await prisma.discount.update({
    where: { id: req.params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.value !== undefined ? { value: body.value } : {}),
      ...(body.scope !== undefined ? { scope: body.scope } : {}),
      ...(body.productId !== undefined ? { productId: body.productId } : {}),
      ...(body.subscriptionId !== undefined ? { subscriptionId: body.subscriptionId } : {}),
      ...(body.minPurchase !== undefined ? { minPurchase: body.minPurchase } : {}),
      ...(body.minQuantity !== undefined ? { minQuantity: body.minQuantity } : {}),
      ...(body.startDate !== undefined ? { startDate: body.startDate } : {}),
      ...(body.endDate !== undefined ? { endDate: body.endDate } : {}),
      ...(body.usageLimit !== undefined ? { usageLimit: body.usageLimit } : {}),
    },
  });

  ok(res, updated);
});

// DELETE /discounts/:id (ADMIN)
r.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const existing = await prisma.discount.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) throw notFound("Discount not found");

  await prisma.discount.delete({
    where: { id: req.params.id },
  });

  ok(res, { message: "Discount deleted" });
});
>>>>>>> Stashed changes

export default r;
