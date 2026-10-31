
import { Router, Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
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

// -------------------- COMMON HELPERS --------------------

const invoiceInclude = {
  customer: true,
  subscription: {
    include: {
      plan: true
    }
  },
  lines: {
    include: {
      tax: true
    }
  },
  payments: true
} satisfies Prisma.InvoiceInclude;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addBillingPeriod(date: Date, frequency: string): Date {
  const result = new Date(date);

  switch (frequency) {
    case "DAILY":
      result.setDate(result.getDate() + 1);
      break;

    case "WEEKLY":
      result.setDate(result.getDate() + 7);
      break;

    case "MONTHLY": {
      const day = result.getDate();
      result.setDate(1);
      result.setMonth(result.getMonth() + 1);

      const lastDay = new Date(
        result.getFullYear(),
        result.getMonth() + 1,
        0
      ).getDate();

      result.setDate(Math.min(day, lastDay));
      break;
    }

    case "YEARLY": {
      const month = result.getMonth();
      const day = result.getDate();

      result.setDate(1);
      result.setFullYear(result.getFullYear() + 1);
      result.setMonth(month);

      const lastDay = new Date(
        result.getFullYear(),
        month + 1,
        0
      ).getDate();

      result.setDate(Math.min(day, lastDay));
      break;
    }

    default:
      throw badRequest(`Unsupported billing frequency: ${frequency}`);
  }

  return result;
}

function calculateDueDate(
  issueDate: Date,
  paymentTerms: string | null
): Date {
  const match = paymentTerms?.match(/net\s*(\d+)/i);
  const days = match ? Number(match[1]) : 30;

  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + days);

  return dueDate;
}

async function generateInvoiceNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const count = await tx.invoice.count();

  return `INV-${String(count + 1).padStart(6, "0")}`;
}

function isOverdue(invoice: {
  status: string;
  dueDate: Date;
  amountPaid: number;
  total: number;
}): boolean {
  return (
    invoice.status === "CONFIRMED" &&
    invoice.dueDate < new Date() &&
    invoice.amountPaid < invoice.total
  );
}

// -------------------- GET ALL INVOICES --------------------

const listSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum([
    "DRAFT",
    "CONFIRMED",
    "PAID",
    "CANCELLED"
  ]).optional(),
  customerId: z.string().optional(),
  search: z.string().trim().optional()
});

r.get(
  "/",
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listSchema.safeParse(req.query);

      if (!parsed.success) {
        throw badRequest(
          "Invalid invoice filters",
          parsed.error.flatten()
        );
      }

      const { page, limit, skip, take } = paging(parsed.data);

      const where: Prisma.InvoiceWhereInput = {
        ...(parsed.data.status
          ? { status: parsed.data.status }
          : {}),
        ...(parsed.data.customerId
          ? { customerId: parsed.data.customerId }
          : {}),
        ...(parsed.data.search
          ? {
              number: {
                contains: parsed.data.search
              }
            }
          : {})
      };

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take,
          include: {
            customer: true,
            subscription: {
              include: {
                plan: true
              }
            },
            lines: {
              include: {
                tax: true
              }
            }
          },
          orderBy: {
            issueDate: "desc"
          }
        }),

        prisma.invoice.count({ where })
      ]);

      const result = invoices.map(invoice => ({
        ...invoice,
        isOverdue: isOverdue(invoice)
      }));

      return ok(res, result, 200, {
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

// -------------------- GET INVOICE DETAILS --------------------

r.get(
  "/:id",
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: req.params.id
        },
        include: invoiceInclude
      });

      if (!invoice) {
        throw notFound("Invoice not found");
      }

      return ok(res, {
        ...invoice,
        isOverdue: isOverdue(invoice)
      });
    } catch (error) {
      next(error);
    }
  }
);

// -------------------- GENERATE DUE INVOICES --------------------

r.post(
  "/generate-due",
  requireRole("ADMIN", "STAFF"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();

      const dueSubscriptions = await prisma.subscription.findMany({
        where: {
          status: "ACTIVE",
          nextBillingDate: {
            lte: now
          }
        },
        select: {
          id: true
        }
      });

      const generated: unknown[] = [];
      const skipped: string[] = [];

      for (const candidate of dueSubscriptions) {
        const result = await prisma.$transaction(async tx => {
          const subscription = await tx.subscription.findUnique({
            where: {
              id: candidate.id
            },
            include: {
              plan: true,
              customer: true,
              lines: {
                include: {
                  tax: true
                }
              }
            }
          });

          if (
            !subscription ||
            subscription.status !== "ACTIVE" ||
            !subscription.nextBillingDate ||
            subscription.nextBillingDate > now
          ) {
            return null;
          }

          const periodStart = subscription.nextBillingDate;

          const periodEnd = addBillingPeriod(
            periodStart,
            subscription.plan.frequency
          );

          // Check for an existing invoice for this billing period.
          const existingInvoice = await tx.invoice.findFirst({
            where: {
              subscriptionId: subscription.id,
              periodStart
            }
          });

          if (existingInvoice) {
            // Repair a stale billing date if an invoice already exists.
            if (existingInvoice.periodEnd > periodStart) {
              await tx.subscription.update({
                where: {
                  id: subscription.id
                },
                data: {
                  nextBillingDate: existingInvoice.periodEnd
                }
              });
            }

            return null;
          }

          if (subscription.lines.length === 0) {
            throw badRequest(
              `Subscription ${subscription.number} has no invoice lines`
            );
          }

          const subtotal = roundMoney(
            subscription.lines.reduce(
              (sum, line) => sum + line.amount,
              0
            )
          );

          const totalQuantity = subscription.lines.reduce(
            (sum, line) => sum + line.quantity,
            0
          );

          const productIds = [
            ...new Set(subscription.lines.map(line => line.productId))
          ];

          // Find applicable discounts.
          const discountCandidates = await tx.discount.findMany({
            where: {
              startDate: {
                lte: now
              },
              OR: [
                { endDate: null },
                { endDate: { gte: now } }
              ],
              AND: [
                {
                  OR: [
                    { subscriptionId: null },
                    { subscriptionId: subscription.id }
                  ]
                },
                {
                  OR: [
                    { scope: "SUBSCRIPTION" },
                    {
                      scope: "PRODUCT",
                      productId: {
                        in: productIds
                      }
                    }
                  ]
                }
              ]
            },
            orderBy: {
              startDate: "desc"
            }
          });

          const discount = discountCandidates.find(item => {
            if (
              item.usageLimit !== null &&
              item.usedCount >= item.usageLimit
            ) {
              return false;
            }

            const eligibleLines =
              item.scope === "PRODUCT"
                ? subscription.lines.filter(
                    line => line.productId === item.productId
                  )
                : subscription.lines;

            const eligibleAmount = eligibleLines.reduce(
              (sum, line) => sum + line.amount,
              0
            );

            const eligibleQuantity = eligibleLines.reduce(
              (sum, line) => sum + line.quantity,
              0
            );

            return (
              eligibleAmount > 0 &&
              (item.minPurchase === null ||
                eligibleAmount >= item.minPurchase) &&
              (item.minQuantity === null ||
                eligibleQuantity >= item.minQuantity)
            );
          });

          let discountAmount = 0;
          let discountId: string | null = null;

          const lineDiscounts = new Map<string, number>();

          if (discount) {
            const eligibleLines =
              discount.scope === "PRODUCT"
                ? subscription.lines.filter(
                    line => line.productId === discount.productId
                  )
                : subscription.lines;

            const discountBase = eligibleLines.reduce(
              (sum, line) => sum + line.amount,
              0
            );

            const rawDiscount =
              discount.type === "PERCENTAGE"
                ? discountBase * discount.value / 100
                : discount.value;

            discountAmount = roundMoney(
              Math.min(discountBase, rawDiscount)
            );

            discountId = discount.id;

            let remaining = discountAmount;

            eligibleLines.forEach((line, index) => {
              const allocation =
                index === eligibleLines.length - 1
                  ? remaining
                  : Math.min(
                      remaining,
                      roundMoney(
                        discountAmount * line.amount / discountBase
                      )
                    );

              lineDiscounts.set(line.id, allocation);
              remaining = roundMoney(remaining - allocation);
            });
          }

          // Retrieve product names for invoice descriptions.
          const products = await tx.product.findMany({
            where: {
              id: {
                in: productIds
              }
            },
            select: {
              id: true,
              name: true
            }
          });

          const productNames = new Map(
            products.map(product => [product.id, product.name])
          );

          const variantIds = subscription.lines
            .map(line => line.variantId)
            .filter((id): id is string => id !== null);

          const variants = await tx.productVariant.findMany({
            where: {
              id: {
                in: variantIds
              }
            },
            select: {
              id: true,
              attribute: true,
              value: true
            }
          });

          const variantDetails = new Map(
            variants.map(variant => [
              variant.id,
              `${variant.attribute}: ${variant.value}`
            ])
          );

          let taxAmount = 0;

          const invoiceLines = subscription.lines.map(line => {
            const allocatedDiscount =
              lineDiscounts.get(line.id) ?? 0;

            const taxableAmount = Math.max(
              0,
              line.amount - allocatedDiscount
            );

            const rate = line.tax?.ratePercent ?? 0;

            const lineTax = roundMoney(
              taxableAmount * rate / 100
            );

            taxAmount += lineTax;

            const productName =
              productNames.get(line.productId) ?? line.productId;

            const variantDescription = line.variantId
              ? variantDetails.get(line.variantId)
              : undefined;

            return {
              productId: line.productId,
              description: variantDescription
                ? `${productName} - ${variantDescription}`
                : productName,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxId: line.taxId,
              taxAmount: lineTax,
              amount: roundMoney(line.amount)
            };
          });

          taxAmount = roundMoney(taxAmount);

          const total = roundMoney(
            subtotal - discountAmount + taxAmount
          );

          if (total < 0) {
            throw badRequest("Invoice total cannot be negative");
          }

          const issueDate = now;

          const dueDate = calculateDueDate(
            issueDate,
            subscription.paymentTerms
          );

          const number = await generateInvoiceNumber(tx);

          const invoice = await tx.invoice.create({
            data: {
              number,
              subscriptionId: subscription.id,
              customerId: subscription.customerId,
              status: "DRAFT",
              periodStart,
              periodEnd,
              issueDate,
              dueDate,
              subtotal,
              discountAmount,
              discountId,
              taxAmount,
              total,
              amountPaid: 0,
              lines: {
                create: invoiceLines
              }
            },
            include: invoiceInclude
          });

          // Increment discount usage inside the same transaction.
          if (discount) {
            const updatedDiscount = await tx.discount.updateMany({
              where: {
                id: discount.id,
                usedCount: discount.usedCount
              },
              data: {
                usedCount: {
                  increment: 1
                }
              }
            });

            if (updatedDiscount.count !== 1) {
              throw conflict(
                "Discount usage changed during invoice generation. Retry the operation."
              );
            }
          }

          // Advance billing date only after invoice creation succeeds.
          await tx.subscription.update({
            where: {
              id: subscription.id
            },
            data: {
              nextBillingDate: periodEnd
            }
          });

          return invoice;
        });

        if (result) {
          generated.push(result);
        } else {
          skipped.push(candidate.id);
        }
      }

      return ok(res, {
        message: "Due invoice generation completed",
        generatedCount: generated.length,
        skippedCount: skipped.length,
        invoices: generated,
        skippedSubscriptionIds: skipped
      });
    } catch (error) {
      next(error);
    }
  }
);

// -------------------- CONFIRM INVOICE --------------------

r.post(
  "/:id/confirm",
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: req.params.id
        }
      });

      if (!invoice) {
        throw notFound("Invoice not found");
      }

      if (invoice.status !== "DRAFT") {
        throw conflict(
          "Only draft invoices can be confirmed"
        );
      }

      const updated = await prisma.invoice.updateMany({
        where: {
          id: invoice.id,
          status: "DRAFT"
        },
        data: {
          status: "CONFIRMED"
        }
      });

      if (updated.count !== 1) {
        throw conflict("Invoice status changed. Please retry.");
      }

      const result = await prisma.invoice.findUnique({
        where: {
          id: invoice.id
        },
        include: invoiceInclude
      });

      return ok(res, result);
    } catch (error) {
      next(error);
    }
  }
);

// -------------------- CANCEL INVOICE --------------------

r.post(
  "/:id/cancel",
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: req.params.id
        }
      });

      if (!invoice) {
        throw notFound("Invoice not found");
      }

      if (
        invoice.status !== "DRAFT" &&
        invoice.status !== "CONFIRMED"
      ) {
        throw conflict(
          "Only draft or confirmed invoices can be cancelled"
        );
      }

      const payments = await prisma.payment.aggregate({
        where: {
          invoiceId: invoice.id
        },
        _sum: {
          amount: true
        }
      });

      if (
        invoice.amountPaid > 0 ||
        (payments._sum.amount ?? 0) > 0
      ) {
        throw conflict(
          "An invoice with recorded payments cannot be cancelled"
        );
      }

      const updated = await prisma.invoice.updateMany({
        where: {
          id: invoice.id,
          status: invoice.status,
          amountPaid: 0
        },
        data: {
          status: "CANCELLED"
        }
      });

      if (updated.count !== 1) {
        throw conflict("Invoice changed during cancellation");
      }

      const result = await prisma.invoice.findUnique({
        where: {
          id: invoice.id
        },
        include: invoiceInclude
      });

      return ok(res, result);
    } catch (error) {
      next(error);
    }
  }
);

// -------------------- SEND INVOICE --------------------

r.post(
  "/:id/send",
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: req.params.id
        },
        include: invoiceInclude
      });

      if (!invoice) {
        throw notFound("Invoice not found");
      }

      if (invoice.status !== "CONFIRMED") {
        throw conflict(
          "Only confirmed invoices can be sent"
        );
      }

      // Email delivery requires an email integration.
      return ok(res, {
        message:
          "Invoice is confirmed and ready for delivery. Email delivery is not configured.",
        invoice
      });
    } catch (error) {
      next(error);
    }
  }
);

// -------------------- PRINT INVOICE --------------------

r.get(
  "/:id/print",
  requireRole("ADMIN", "STAFF"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: req.params.id
        },
        include: invoiceInclude
      });

      if (!invoice) {
        throw notFound("Invoice not found");
      }

      // Return printable invoice data for the frontend.
      // The frontend can render this data and invoke window.print().
      return ok(res, {
        ...invoice,
        isOverdue: isOverdue(invoice),
        printable: true
      });
    } catch (error) {
      next(error);
    }
  }
);

export default r;
