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

const createTaxSchema = z.object({
  name: z.string().trim().min(2).max(100),
  ratePercent: z.number().finite().min(0).max(100),
  isActive: z.boolean().optional().default(true)
});

const updateTaxSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  ratePercent: z.number().finite().min(0).max(100).optional(),
  isActive: z.boolean().optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

const listTaxSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  isActive: z.enum(["true", "false"]).optional()
});

// -------------------- GET ALL TAXES --------------------

r.get(
  "/",
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listTaxSchema.safeParse(req.query);

      if (!parsed.success) {
        throw badRequest("Invalid query parameters", parsed.error.flatten());
      }

      const { search, isActive } = parsed.data;
      const { page, limit, skip, take } = paging(parsed.data);

      const where = {
        ...(search
          ? { name: { contains: search } }
          : {}),
        ...(isActive !== undefined
          ? { isActive: isActive === "true" }
          : {})
      };

      const [taxes, total] = await Promise.all([
        prisma.tax.findMany({
          where,
          skip,
          take,
          orderBy: { name: "asc" }
        }),
        prisma.tax.count({ where })
      ]);

      return ok(res, taxes, 200, {
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

// -------------------- CREATE TAX --------------------

r.post(
  "/",
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createTaxSchema.safeParse(req.body);

      if (!parsed.success) {
        throw badRequest("Invalid tax details", parsed.error.flatten());
      }

      const tax = await prisma.tax.create({
        data: {
          name: parsed.data.name,
          ratePercent: parsed.data.ratePercent,
          isActive: parsed.data.isActive
        }
      });

      return ok(res, tax, 201);
    } catch (error) {
      next(error);
    }
  }
);

// -------------------- UPDATE TAX --------------------

r.patch(
  "/:id",
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = z.string().min(1).safeParse(req.params.id);

      if (!id.success) {
        throw badRequest("Invalid tax ID");
      }

      const parsed = updateTaxSchema.safeParse(req.body);

      if (!parsed.success) {
        throw badRequest("Invalid tax details", parsed.error.flatten());
      }

      const existingTax = await prisma.tax.findUnique({
        where: { id: id.data }
      });

      if (!existingTax) {
        throw notFound("Tax not found");
      }

      const updatedTax = await prisma.tax.update({
        where: { id: id.data },
        data: parsed.data
      });

      return ok(res, updatedTax);
    } catch (error) {
      next(error);
    }
  }
);

// -------------------- DELETE TAX --------------------

r.delete(
  "/:id",
  requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = z.string().min(1).safeParse(req.params.id);

      if (!id.success) {
        throw badRequest("Invalid tax ID");
      }

      const existingTax = await prisma.tax.findUnique({
        where: { id: id.data },
        include: {
          _count: {
            select: {
              subscriptionLines: true,
              invoiceLines: true
            }
          }
        }
      });

      if (!existingTax) {
        throw notFound("Tax not found");
      }

      // Prevent deletion when tax is already referenced.
      if (
        existingTax._count.subscriptionLines > 0 ||
        existingTax._count.invoiceLines > 0
      ) {
        throw conflict(
          "This tax is already used by subscriptions or invoices. Deactivate it instead."
        );
      }

      await prisma.tax.delete({
        where: { id: id.data }
      });

      return ok(res, {
        message: "Tax deleted successfully",
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
import { notFound } from "../../utils/errors";
import { ok, paging } from "../../utils/response";

const r = Router();
r.use(requireAuth);

const createTaxSchema = z.object({
  name: z.string().min(1, "Name is required"),
  ratePercent: z.number().min(0, "Rate percent cannot be negative"),
  isActive: z.boolean().optional().default(true),
});

const updateTaxSchema = z.object({
  name: z.string().min(1).optional(),
  ratePercent: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

// GET /taxes (ADMIN, STAFF)
r.get("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const { page, limit, skip, take } = paging(req.query);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
  const isActive =
    req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined;

  const where: any = {};
  if (search) where.name = { contains: search };
  if (isActive !== undefined) where.isActive = isActive;

  const [total, data] = await Promise.all([
    prisma.tax.count({ where }),
    prisma.tax.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
    }),
  ]);

  ok(res, data, 200, { page, limit, total });
});

// POST /taxes (ADMIN)
r.post("/", requireRole("ADMIN"), async (req, res) => {
  const body = createTaxSchema.parse(req.body);

  const tax = await prisma.tax.create({
    data: {
      name: body.name.trim(),
      ratePercent: body.ratePercent,
      isActive: body.isActive ?? true,
    },
  });

  ok(res, tax, 201);
});

// PATCH /taxes/:id (ADMIN)
r.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const body = updateTaxSchema.parse(req.body);

  const existing = await prisma.tax.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) throw notFound("Tax not found");

  const updated = await prisma.tax.update({
    where: { id: req.params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.ratePercent !== undefined ? { ratePercent: body.ratePercent } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });

  ok(res, updated);
});

// DELETE /taxes/:id (ADMIN)
r.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const existing = await prisma.tax.findUnique({
    where: { id: req.params.id },
  });
  if (!existing) throw notFound("Tax not found");

  await prisma.tax.delete({
    where: { id: req.params.id },
  });

  ok(res, { message: "Tax deleted" });
});
>>>>>>> Stashed changes

export default r;
