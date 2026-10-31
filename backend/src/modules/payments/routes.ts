// OWNER: Member 3
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { badRequest, notFound } from "../../utils/errors";
import { ok, paging } from "../../utils/response";
import { PAYMENT_METHODS } from "../../../../shared/constants";
import { roundMoney } from "../../utils/billing";

const r = Router();
r.use(requireAuth);

const createPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  method: z.enum(PAYMENT_METHODS),
  amount: z.number().positive("Payment amount must be greater than 0"),
  paidAt: z
    .string()
    .or(z.date())
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
  note: z.string().optional().nullable(),
});

// GET /payments (ADMIN, STAFF)
r.get("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const { page, limit, skip, take } = paging(req.query);
  const invoiceId = typeof req.query.invoiceId === "string" ? req.query.invoiceId : undefined;
  const method = typeof req.query.method === "string" ? req.query.method : undefined;

  const where: any = {};
  if (invoiceId) where.invoiceId = invoiceId;
  if (method) where.method = method;

  const [total, data] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { paidAt: "desc" },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            total: true,
            amountPaid: true,
            status: true,
            customer: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    }),
  ]);

  ok(res, data, 200, { page, limit, total });
});

// POST /payments (ADMIN, STAFF)
r.post("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const body = createPaymentSchema.parse(req.body);

  const invoice = await prisma.invoice.findUnique({
    where: { id: body.invoiceId },
    include: { payments: true },
  });

  if (!invoice) throw notFound("Invoice not found");
  if (invoice.status === "CANCELLED") {
    throw badRequest("Cannot record payment for a cancelled invoice");
  }

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        invoiceId: body.invoiceId,
        method: body.method,
        amount: roundMoney(body.amount),
        paidAt: body.paidAt,
        note: body.note?.trim() ?? null,
        recordedById: req.user!.id,
      },
    });

    // Sum all payments for this invoice
    const allPayments = await tx.payment.findMany({
      where: { invoiceId: body.invoiceId },
      select: { amount: true },
    });

    const newAmountPaid = roundMoney(
      allPayments.reduce((sum, p) => sum + p.amount, 0)
    );

    let newStatus = invoice.status;
    if (newAmountPaid >= invoice.total) {
      newStatus = "PAID";
    } else if (invoice.status === "DRAFT") {
      newStatus = "CONFIRMED";
    }

    await tx.invoice.update({
      where: { id: body.invoiceId },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
      },
    });

    return created;
  });

  ok(res, payment, 201);
});

// GET /payments/:id (ADMIN, STAFF)
r.get("/:id", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    include: {
      invoice: {
        include: {
          customer: true,
        },
      },
    },
  });

  if (!payment) throw notFound("Payment not found");

  ok(res, payment);
});

// GET /payments/by-invoice/:invoiceId (ADMIN, STAFF)
r.get("/by-invoice/:invoiceId", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { invoiceId: req.params.invoiceId },
    orderBy: { paidAt: "desc" },
  });

  ok(res, payments);
});

export default r;
