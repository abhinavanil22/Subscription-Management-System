
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

export default r;
