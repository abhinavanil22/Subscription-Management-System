// OWNER: Member 3
import { Router } from "express";
import { prisma } from "../../db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { forbidden, notFound } from "../../utils/errors";
import { ok, paging } from "../../utils/response";

const r = Router();
r.use(requireAuth, requireRole("CUSTOMER"));

async function getCustomerIdForUser(userId: string): Promise<string> {
  const customer = await prisma.customer.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!customer) throw forbidden("No customer profile associated with this account");
  return customer.id;
}

// GET /portal/subscriptions (CUSTOMER)
r.get("/subscriptions", async (req, res) => {
  const customerId = await getCustomerIdForUser(req.user!.id);
  const { page, limit, skip, take } = paging(req.query);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const where: any = { customerId };
  if (status) where.status = status;

  const [total, data] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        plan: true,
        lines: {
          include: { tax: true },
        },
      },
    }),
  ]);

  ok(res, data, 200, { page, limit, total });
});

// GET /portal/subscriptions/:id (CUSTOMER)
r.get("/subscriptions/:id", async (req, res) => {
  const customerId = await getCustomerIdForUser(req.user!.id);

  const subscription = await prisma.subscription.findFirst({
    where: {
      id: req.params.id,
      customerId,
    },
    include: {
      plan: true,
      lines: {
        include: { tax: true },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!subscription) throw notFound("Subscription not found");

  ok(res, subscription);
});

// GET /portal/invoices (CUSTOMER)
r.get("/invoices", async (req, res) => {
  const customerId = await getCustomerIdForUser(req.user!.id);
  const { page, limit, skip, take } = paging(req.query);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const where: any = { customerId };
  if (status) where.status = status;

  const [total, data] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        subscription: { select: { number: true } },
        lines: true,
        payments: true,
      },
    }),
  ]);

  ok(res, data, 200, { page, limit, total });
});

// GET /portal/invoices/:id (CUSTOMER)
r.get("/invoices/:id", async (req, res) => {
  const customerId = await getCustomerIdForUser(req.user!.id);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: req.params.id,
      customerId,
    },
    include: {
      subscription: { include: { plan: true } },
      lines: { include: { tax: true } },
      payments: { orderBy: { paidAt: "desc" } },
      discount: true,
    },
  });

  if (!invoice) throw notFound("Invoice not found");

  ok(res, invoice);
});

// GET /portal/payments (CUSTOMER)
r.get("/payments", async (req, res) => {
  const customerId = await getCustomerIdForUser(req.user!.id);
  const { page, limit, skip, take } = paging(req.query);

  const where = {
    invoice: {
      customerId,
    },
  };

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
            status: true,
          },
        },
      },
    }),
  ]);

  ok(res, data, 200, { page, limit, total });
});

export default r;
