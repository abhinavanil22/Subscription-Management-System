// OWNER: Member 3
import { Router } from "express";
import { prisma } from "../../db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { ok } from "../../utils/response";
import { roundMoney } from "../../utils/billing";

const r = Router();
r.use(requireAuth);

// GET /dashboard/summary (ADMIN, STAFF)
r.get("/summary", requireRole("ADMIN", "STAFF"), async (_req, res) => {
  const now = new Date();

  const [
    activeSubscriptions,
    totalCustomers,
    invoiceCount,
    paidInvoicesCount,
    overdueInvoicesCount,
    revenueAgg,
  ] = await Promise.all([
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.customer.count(),
    prisma.invoice.count({ where: { status: { not: "CANCELLED" } } }),
    prisma.invoice.count({ where: { status: "PAID" } }),
    prisma.invoice.count({
      where: {
        status: "CONFIRMED",
        dueDate: { lt: now },
      },
    }),
    prisma.invoice.aggregate({
      where: { status: { not: "CANCELLED" } },
      _sum: {
        total: true,
        amountPaid: true,
      },
    }),
  ]);

  const totalBilled = roundMoney(revenueAgg._sum.total ?? 0);
  const paidRevenue = roundMoney(revenueAgg._sum.amountPaid ?? 0);
  const outstandingRevenue = roundMoney(Math.max(0, totalBilled - paidRevenue));

  ok(res, {
    activeSubscriptions,
    totalCustomers,
    invoiceCount,
    paidInvoicesCount,
    overdueInvoicesCount,
    totalBilled,
    paidRevenue,
    outstandingRevenue,
  });
});

// GET /dashboard/active-subscriptions (ADMIN, STAFF)
r.get("/active-subscriptions", requireRole("ADMIN", "STAFF"), async (_req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      customer: { select: { id: true, name: true, email: true } },
      plan: { select: { id: true, name: true, price: true, frequency: true } },
      lines: true,
    },
  });

  ok(res, subscriptions);
});

// GET /dashboard/revenue (ADMIN, STAFF)
r.get("/revenue", requireRole("ADMIN", "STAFF"), async (_req, res) => {
  const [paymentsByMethod, totalRevenueAgg, recentPayments] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method"],
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      orderBy: { paidAt: "desc" },
      take: 10,
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            customer: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  ok(res, {
    totalRevenue: roundMoney(totalRevenueAgg._sum.amount ?? 0),
    byMethod: paymentsByMethod.map((item) => ({
      method: item.method,
      totalAmount: roundMoney(item._sum.amount ?? 0),
      count: item._count,
    })),
    recentPayments,
  });
});

// GET /dashboard/overdue-invoices (ADMIN, STAFF)
r.get("/overdue-invoices", requireRole("ADMIN", "STAFF"), async (_req, res) => {
  const now = new Date();

  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: "CONFIRMED",
      dueDate: { lt: now },
    },
    orderBy: { dueDate: "asc" },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      subscription: { select: { number: true } },
    },
  });

  const formatted = overdueInvoices.map((inv) => ({
    ...inv,
    balanceDue: roundMoney(inv.total - inv.amountPaid),
  }));

  ok(res, formatted);
});

export default r;
