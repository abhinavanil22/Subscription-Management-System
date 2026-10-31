import { Prisma, PrismaClient } from "@prisma/client";
import { BillingFrequency } from "../../../shared/constants";
import { badRequest, conflict } from "./errors";

type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export function advanceBillingDate(date: Date, frequency: BillingFrequency): Date {
  const next = new Date(date);
  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export function parsePaymentTermsDays(terms?: string | null): number {
  if (!terms) return 15;
  const match = terms.match(/\d+/);
  return match ? parseInt(match[0], 10) : 15;
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export async function generateInvoiceForSubscription(
  tx: PrismaTx,
  subscriptionId: string,
  targetDate?: Date
) {
  const subscription = await tx.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      customer: true,
      lines: {
        include: {
          tax: true,
        },
      },
    },
  });

  if (!subscription) {
    throw badRequest("Subscription not found");
  }

  if (subscription.status !== "ACTIVE") {
    throw badRequest(`Cannot generate invoice for subscription in status ${subscription.status}`);
  }

  const billingDate = targetDate ?? subscription.nextBillingDate ?? subscription.startDate;
  const periodStart = new Date(billingDate);
  // normalize time to midnight UTC/consistent start
  periodStart.setHours(0, 0, 0, 0);

  const periodEnd = advanceBillingDate(periodStart, subscription.plan.frequency as BillingFrequency);
  periodEnd.setHours(0, 0, 0, 0);

  // Application-level duplicate check
  const existingInvoice = await tx.invoice.findFirst({
    where: {
      subscriptionId: subscription.id,
      periodStart,
    },
  });

  if (existingInvoice) {
    throw conflict(
      `Invoice already exists for subscription ${subscription.number} for period starting ${periodStart.toISOString().split("T")[0]}`
    );
  }

  // Calculate lines
  let subtotal = 0;
  let totalQuantity = 0;
  let taxAmount = 0;

  // We need product details for invoice line descriptions
  const productIds = subscription.lines.map((l) => l.productId);
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    include: { variants: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const invoiceLinesData = subscription.lines.map((l) => {
    const prod = productMap.get(l.productId);
    const variant = prod?.variants.find((v) => v.id === l.variantId);
    const desc = prod
      ? `${prod.name}${variant ? ` - ${variant.attribute}: ${variant.value}` : ""}`
      : "Product Service";

    const lineAmount = roundMoney(l.quantity * l.unitPrice);
    subtotal += lineAmount;
    totalQuantity += l.quantity;

    let lineTax = 0;
    if (l.tax && l.tax.isActive) {
      lineTax = roundMoney((lineAmount * l.tax.ratePercent) / 100);
      taxAmount += lineTax;
    }

    return {
      productId: l.productId,
      description: desc,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxId: l.taxId,
      taxAmount: lineTax,
      amount: lineAmount,
    };
  });

  subtotal = roundMoney(subtotal);
  taxAmount = roundMoney(taxAmount);

  // Check discount
  const now = new Date();
  const eligibleDiscount = await tx.discount.findFirst({
    where: {
      OR: [
        { subscriptionId: subscription.id },
        { scope: "SUBSCRIPTION" },
      ],
      startDate: { lte: now },
      AND: [
        {
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
      ],
    },
    orderBy: { value: "desc" },
  });

  let discountAmount = 0;
  let discountId: string | null = null;

  if (eligibleDiscount) {
    const usageOk =
      eligibleDiscount.usageLimit === null || eligibleDiscount.usedCount < eligibleDiscount.usageLimit;
    const minPurchaseOk =
      eligibleDiscount.minPurchase === null || subtotal >= eligibleDiscount.minPurchase;
    const minQtyOk =
      eligibleDiscount.minQuantity === null || totalQuantity >= eligibleDiscount.minQuantity;

    if (usageOk && minPurchaseOk && minQtyOk) {
      discountId = eligibleDiscount.id;
      if (eligibleDiscount.type === "PERCENTAGE") {
        discountAmount = roundMoney((subtotal * eligibleDiscount.value) / 100);
      } else {
        discountAmount = roundMoney(Math.min(subtotal, eligibleDiscount.value));
      }

      // Increment usedCount
      await tx.discount.update({
        where: { id: eligibleDiscount.id },
        data: { usedCount: { increment: 1 } },
      });
    }
  }

  const total = roundMoney(Math.max(0, subtotal - discountAmount + taxAmount));

  // Determine invoice number
  const invoiceCount = await tx.invoice.count();
  const invNumber = `INV-${String(invoiceCount + 1).padStart(6, "0")}`;

  const issueDate = new Date();
  const dueDays = parsePaymentTermsDays(subscription.paymentTerms);
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + dueDays);

  // Create invoice
  const invoice = await tx.invoice.create({
    data: {
      number: invNumber,
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
        create: invoiceLinesData,
      },
    },
    include: {
      lines: true,
      customer: true,
      subscription: true,
    },
  });

  // Advance nextBillingDate atomically
  const nextBillingDate = advanceBillingDate(
    periodStart,
    subscription.plan.frequency as BillingFrequency
  );

  await tx.subscription.update({
    where: { id: subscription.id },
    data: { nextBillingDate },
  });

  return invoice;
}
