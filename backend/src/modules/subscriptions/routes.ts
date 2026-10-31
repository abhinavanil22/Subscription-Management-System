import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_TRANSITIONS,
  type SubscriptionStatus
} from "../../../../shared/constants";
import { prisma } from "../../db";
import { requireAuth, requireRole } from "../../middleware/auth";
import { badRequest, notFound, conflict } from "../../utils/errors";
import { ok, paging } from "../../utils/response";

const r = Router();
r.use(requireAuth);

const lineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  taxId: z.string().min(1).nullable().optional(),
  quantity: z.number().int().positive()
});

const createSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().min(1),
  templateId: z.string().min(1).optional(),
  startDate: z.coerce.date(),
  expiryDate: z.coerce.date().nullable().optional(),
  paymentTerms: z.string().max(100).optional(),
  lines: z.array(lineSchema).min(1).optional()
}).refine(
  data => data.lines?.length || data.templateId,
  { message: "Provide subscription lines or a quotation template" }
);

const updateSchema = z.object({
  customerId: z.string().min(1).optional(),
  planId: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  paymentTerms: z.string().max(100).nullable().optional(),
  lines: z.array(lineSchema).min(1).optional()
}).refine(
  data => Object.keys(data).length > 0,
  { message: "At least one field must be provided" }
);

const transitionSchema = z.object({
  status: z.enum(SUBSCRIPTION_STATUSES),
  validityDays: z.number().int().positive().max(3650).optional()
});

type LineInput = z.infer<typeof lineSchema>;

async function validateCustomer(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  });

  if (!customer) throw notFound("Customer not found");
  return customer;
}

async function validatePlan(planId: string, startDate: Date) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId }
  });

  if (!plan) throw notFound("Plan not found");
  if (plan.status !== "ACTIVE") {
    throw badRequest("Only active plans can be used for subscriptions");
  }

  if (plan.availableFrom > startDate) {
    throw badRequest("Plan is not available on the subscription start date");
  }

  if (plan.availableTo && plan.availableTo < startDate) {
    throw badRequest("Plan availability has expired");
  }

  return plan;
}

async function prepareLines(lines: LineInput[]) {
  const prepared = [];

  for (const line of lines) {
    const product = await prisma.product.findUnique({
      where: { id: line.productId }
    });

    if (!product || !product.isActive) {
      throw badRequest(`Product ${line.productId} is unavailable`);
    }

    let unitPrice = product.salesPrice;

    if (line.variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: line.variantId }
      });

      if (!variant || variant.productId !== line.productId) {
        throw badRequest("Invalid product variant");
      }

      unitPrice += variant.priceAdjustment;
    }

    if (unitPrice < 0) {
      throw badRequest("Product price cannot be negative");
    }

    if (line.taxId) {
      const tax = await prisma.tax.findUnique({
        where: { id: line.taxId }
      });

      if (!tax || !tax.isActive) {
        throw badRequest("Tax does not exist or is inactive");
      }
    }

    prepared.push({
      productId: line.productId,
      variantId: line.variantId ?? null,
      taxId: line.taxId ?? null,
      quantity: line.quantity,
      unitPrice,
      amount: unitPrice * line.quantity
    });
  }

  return prepared;
}

function validateMinimumQuantity(
  totalQuantity: number,
  minimum: number
) {
  if (totalQuantity < minimum) {
    throw badRequest(
      `Minimum plan quantity is ${minimum}. Current quantity is ${totalQuantity}`
    );
  }
}

async function generateNumber(tx: Prisma.TransactionClient) {
  const count = await tx.subscription.count();

  return `SUB-${String(count + 1).padStart(6, "0")}`;
}

// GET /api/v1/subscriptions
r.get("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const { page, limit, skip, take } = paging(req.query);

  const where: Prisma.SubscriptionWhereInput = {};

  if (typeof req.query.status === "string") {
    if (!SUBSCRIPTION_STATUSES.includes(
      req.query.status as SubscriptionStatus
    )) {
      throw badRequest("Invalid subscription status");
    }

    where.status = req.query.status;
  }

  if (typeof req.query.customerId === "string") {
    where.customerId = req.query.customerId;
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      skip,
      take,
      include: {
        customer: true,
        plan: true,
        lines: { include: { tax: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.subscription.count({ where })
  ]);

  return ok(res, subscriptions, 200, { page, limit, total });
});

// POST /api/v1/subscriptions
r.post("/", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);

  if (!parsed.success) {
    throw badRequest("Invalid subscription data", parsed.error.flatten());
  }

  const data = parsed.data;

  await validateCustomer(data.customerId);

  const plan = await validatePlan(data.planId, data.startDate);

  let inputLines = data.lines;

  if (data.templateId) {
    const template = await prisma.quotationTemplate.findUnique({
      where: { id: data.templateId },
      include: { lines: true }
    });

    if (!template) throw notFound("Quotation template not found");

    if (template.planId !== data.planId) {
      throw badRequest("Template does not belong to the selected plan");
    }

    if (!inputLines) {
      inputLines = template.lines.map(line => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity
      }));
    }
  }

  if (!inputLines?.length) {
    throw badRequest("At least one subscription line is required");
  }

  const preparedLines = await prepareLines(inputLines);

  const totalQuantity = preparedLines.reduce(
    (sum, line) => sum + line.quantity,
    0
  );

  validateMinimumQuantity(totalQuantity, plan.minQuantity);

  if (
    data.expiryDate &&
    data.expiryDate <= data.startDate
  ) {
    throw badRequest("Expiry date must be after the start date");
  }

  const subscription = await prisma.$transaction(async tx => {
    const number = await generateNumber(tx);

    return tx.subscription.create({
      data: {
        number,
        customerId: data.customerId,
        planId: data.planId,
        templateId: data.templateId,
        startDate: data.startDate,
        expiryDate: data.expiryDate,
        paymentTerms: data.paymentTerms,
        createdById: req.user?.id,
        status: SUBSCRIPTION_STATUSES[0],
        lines: {
          create: preparedLines
        }
      },
      include: {
        customer: true,
        plan: true,
        lines: { include: { tax: true } }
      }
    });
  });

  return ok(res, subscription, 201);
});

// GET /api/v1/subscriptions/:id
r.get("/:id", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: req.params.id },
    include: {
      customer: true,
      plan: true,
      lines: { include: { tax: true } },
      invoices: true
    }
  });

  if (!subscription) throw notFound("Subscription not found");

  return ok(res, subscription);
});

// PATCH /api/v1/subscriptions/:id
r.patch("/:id", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);

  if (!parsed.success) {
    throw badRequest("Invalid subscription update", parsed.error.flatten());
  }

  const existing = await prisma.subscription.findUnique({
    where: { id: req.params.id },
    include: { lines: true }
  });

  if (!existing) throw notFound("Subscription not found");

  if (
    existing.status !== SUBSCRIPTION_STATUSES[0] &&
    existing.status !== SUBSCRIPTION_STATUSES[1]
  ) {
    throw conflict("Only draft subscriptions or quotations can be edited");
  }

  const data = parsed.data;

  const customerId = data.customerId ?? existing.customerId;
  const planId = data.planId ?? existing.planId;
  const startDate = data.startDate ?? existing.startDate;

  if (data.customerId) {
    await validateCustomer(data.customerId);
  }

  const plan = await validatePlan(planId, startDate);

  const preparedLines = data.lines
    ? await prepareLines(data.lines)
    : existing.lines;

  const totalQuantity = preparedLines.reduce(
    (sum, line) => sum + line.quantity,
    0
  );

  validateMinimumQuantity(totalQuantity, plan.minQuantity);

  const expiryDate = data.expiryDate === undefined
    ? existing.expiryDate
    : data.expiryDate;

  if (expiryDate && expiryDate <= startDate) {
    throw badRequest("Expiry date must be after the start date");
  }

  const updateData: Prisma.SubscriptionUpdateInput = {
    customer: { connect: { id: customerId } },
    plan: { connect: { id: planId } },
    startDate,
    expiryDate,
    paymentTerms: data.paymentTerms
  };

  if (data.lines) {
    updateData.lines = {
      deleteMany: {},
      create: preparedLines.map(line => ({
        productId: line.productId,
        variantId: line.variantId,
        taxId: line.taxId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount
      }))
    };
  }

  const updated = await prisma.subscription.update({
    where: { id: req.params.id },
    data: updateData,
    include: {
      customer: true,
      plan: true,
      lines: { include: { tax: true } }
    }
  });

  return ok(res, updated);
});

// POST /api/v1/subscriptions/:id/transition
r.post("/:id/transition", requireRole("ADMIN", "STAFF"), async (req, res) => {
  const parsed = transitionSchema.safeParse(req.body);

  if (!parsed.success) {
    throw badRequest("Invalid transition data", parsed.error.flatten());
  }

  const { status: targetStatus, validityDays = 30 } = parsed.data;

  const existing = await prisma.subscription.findUnique({
    where: { id: req.params.id },
    include: { lines: true }
  });

  if (!existing) throw notFound("Subscription not found");

  const currentStatus = existing.status as SubscriptionStatus;

  const allowedTransitions = SUBSCRIPTION_TRANSITIONS[currentStatus];

  if (!allowedTransitions?.includes(targetStatus)) {
    throw conflict(
      `Transition from ${currentStatus} to ${targetStatus} is not allowed`
    );
  }

  const now = new Date();

  if (
    targetStatus === SUBSCRIPTION_STATUSES[2] &&
    existing.quotationValidUntil &&
    existing.quotationValidUntil < now
  ) {
    throw conflict("Quotation has expired");
  }

  const updateData: Prisma.SubscriptionUpdateInput = {
    status: targetStatus
  };

  if (targetStatus === SUBSCRIPTION_STATUSES[1]) {
    updateData.quotationValidUntil = new Date(
      now.getTime() + validityDays * 24 * 60 * 60 * 1000
    );
  }

  if (
    targetStatus === SUBSCRIPTION_STATUSES[3] &&
    !existing.nextBillingDate
  ) {
    updateData.nextBillingDate = existing.startDate;
  }

  const updated = await prisma.subscription.update({
    where: { id: req.params.id },
    data: updateData,
    include: {
      customer: true,
      plan: true,
      lines: true
    }
  });

  return ok(res, updated);
});

// Invoice generation will be connected to the invoice module.
r.post(
  "/:id/generate-invoice",
  requireRole("ADMIN", "STAFF"),
  async (_req, _res) => {
    throw badRequest(
      "Individual invoice generation will be enabled with the invoice module"
    );
  }
);

export default r;