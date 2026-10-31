import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@brightloop.test";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // 1. Admin user
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: {
      email: adminEmail,
      name: "Admin User",
      role: "ADMIN",
      passwordHash,
    },
  });
  console.log("Seeded admin:", adminUser.email);

  // 2. Staff user
  const staffEmail = "staff@brightloop.test";
  const staffHash = await bcrypt.hash("Staff@12345", 10);
  const staffUser = await prisma.user.upsert({
    where: { email: staffEmail },
    update: { passwordHash: staffHash },
    create: {
      email: staffEmail,
      name: "Sarah Staff",
      role: "STAFF",
      passwordHash: staffHash,
    },
  });
  console.log("Seeded staff:", staffUser.email);

  // 3. Customer user
  const customerEmail = "customer@brightloop.test";
  const customerHash = await bcrypt.hash("Customer@12345", 10);
  const customerUser = await prisma.user.upsert({
    where: { email: customerEmail },
    update: { passwordHash: customerHash },
    create: {
      email: customerEmail,
      name: "Acme Customer",
      role: "CUSTOMER",
      passwordHash: customerHash,
    },
  });
  console.log("Seeded customer user:", customerUser.email);

  // 4. Customers
  let cust1 = await prisma.customer.findFirst({ where: { email: customerEmail } });
  if (!cust1) {
    cust1 = await prisma.customer.create({
      data: {
        userId: customerUser.id,
        name: "Acme Corporation",
        email: customerEmail,
        phone: "+91 9876543210",
        address: "100 Tech Park, Bengaluru",
        company: "Acme Corp",
      },
    });
  }

  let cust2 = await prisma.customer.findFirst({ where: { email: "contact@globex.test" } });
  if (!cust2) {
    cust2 = await prisma.customer.create({
      data: {
        name: "Globex Logistics",
        email: "contact@globex.test",
        phone: "+91 9876500000",
        address: "24 Cargo Hub, Mumbai",
        company: "Globex Logistics",
      },
    });
  }

  let cust3 = await prisma.customer.findFirst({ where: { email: "bruce@wayne.test" } });
  if (!cust3) {
    cust3 = await prisma.customer.create({
      data: {
        name: "Wayne Enterprises",
        email: "bruce@wayne.test",
        phone: "+91 9999999999",
        address: "1 Wayne Tower, Gotham",
        company: "Wayne Enterprises",
      },
    });
  }

  // 5. Products & Variants
  let prod1 = await prisma.product.findFirst({ where: { name: "Business Software" } });
  if (!prod1) {
    prod1 = await prisma.product.create({
      data: {
        name: "Business Software",
        type: "SERVICE",
        salesPrice: 1000,
        costPrice: 400,
        notes: "Enterprise cloud accounting and subscription suite",
        variants: {
          create: [
            { attribute: "Edition", value: "Standard", priceAdjustment: 0 },
            { attribute: "Edition", value: "Odoo", priceAdjustment: 560 },
            { attribute: "Edition", value: "Enterprise", priceAdjustment: 2000 },
          ],
        },
      },
    });
  }

  let prod2 = await prisma.product.findFirst({ where: { name: "Cloud Server Hosting" } });
  if (!prod2) {
    prod2 = await prisma.product.create({
      data: {
        name: "Cloud Server Hosting",
        type: "SERVICE",
        salesPrice: 500,
        costPrice: 200,
        notes: "Managed VPS with 99.9% uptime SLA",
        variants: {
          create: [
            { attribute: "RAM", value: "16GB", priceAdjustment: 200 },
            { attribute: "RAM", value: "32GB", priceAdjustment: 500 },
          ],
        },
      },
    });
  }

  let prod3 = await prisma.product.findFirst({ where: { name: "Hardware POS Terminal" } });
  if (!prod3) {
    prod3 = await prisma.product.create({
      data: {
        name: "Hardware POS Terminal",
        type: "GOODS",
        salesPrice: 15000,
        costPrice: 11000,
        notes: "Barcode reader and receipt printer included",
      },
    });
  }

  // 6. Taxes
  let taxGst18 = await prisma.tax.findFirst({ where: { name: "GST 18%" } });
  if (!taxGst18) {
    taxGst18 = await prisma.tax.create({
      data: { name: "GST 18%", ratePercent: 18, isActive: true },
    });
  }

  let taxGst5 = await prisma.tax.findFirst({ where: { name: "GST 5%" } });
  if (!taxGst5) {
    taxGst5 = await prisma.tax.create({
      data: { name: "GST 5%", ratePercent: 5, isActive: true },
    });
  }

  // 7. Discounts
  let discount10 = await prisma.discount.findFirst({ where: { name: "WELCOME10" } });
  if (!discount10) {
    discount10 = await prisma.discount.create({
      data: {
        name: "WELCOME10",
        type: "PERCENTAGE",
        value: 10,
        scope: "SUBSCRIPTION",
        minPurchase: 500,
        startDate: new Date("2024-01-01"),
        usageLimit: 100,
      },
    });
  }

  let discount500 = await prisma.discount.findFirst({ where: { name: "SAVE500" } });
  if (!discount500) {
    discount500 = await prisma.discount.create({
      data: {
        name: "SAVE500",
        type: "FIXED",
        value: 500,
        scope: "SUBSCRIPTION",
        minPurchase: 2000,
        startDate: new Date("2024-01-01"),
        usageLimit: 50,
      },
    });
  }

  // 8. Plans
  let planMonthly = await prisma.plan.findFirst({ where: { name: "Monthly Pro" } });
  if (!planMonthly) {
    planMonthly = await prisma.plan.create({
      data: {
        name: "Monthly Pro",
        price: 1500,
        frequency: "MONTHLY",
        minQuantity: 1,
        availableFrom: new Date("2024-01-01"),
        status: "ACTIVE",
        closable: true,
        pausable: true,
        renewable: true,
      },
    });
  }

  let planAnnual = await prisma.plan.findFirst({ where: { name: "Annual Enterprise" } });
  if (!planAnnual) {
    planAnnual = await prisma.plan.create({
      data: {
        name: "Annual Enterprise",
        price: 15000,
        frequency: "YEARLY",
        minQuantity: 1,
        availableFrom: new Date("2024-01-01"),
        status: "ACTIVE",
        closable: true,
        pausable: true,
        renewable: true,
      },
    });
  }

  let planWeekly = await prisma.plan.findFirst({ where: { name: "Weekly Starter" } });
  if (!planWeekly) {
    planWeekly = await prisma.plan.create({
      data: {
        name: "Weekly Starter",
        price: 400,
        frequency: "WEEKLY",
        minQuantity: 2,
        availableFrom: new Date("2024-01-01"),
        status: "ACTIVE",
        closable: true,
        pausable: true,
        renewable: true,
      },
    });
  }

  // 9. Quotation Template
  let template = await prisma.quotationTemplate.findFirst({ where: { name: "Standard SaaS Template" } });
  if (!template) {
    template = await prisma.quotationTemplate.create({
      data: {
        name: "Standard SaaS Template",
        planId: planMonthly.id,
        validityDays: 30,
        lines: {
          create: [
            { productId: prod1.id, quantity: 1 },
            { productId: prod2.id, quantity: 2 },
          ],
        },
      },
    });
  }

  // 10. Subscriptions
  // A. Active subscription for Acme Customer
  let sub1 = await prisma.subscription.findUnique({ where: { number: "SUB-000001" } });
  if (!sub1) {
    const nextBill = new Date();
    nextBill.setDate(nextBill.getDate() + 15);

    sub1 = await prisma.subscription.create({
      data: {
        number: "SUB-000001",
        customerId: cust1.id,
        planId: planMonthly.id,
        status: "ACTIVE",
        startDate: new Date("2025-01-01"),
        nextBillingDate: nextBill,
        paymentTerms: "Net 15",
        createdById: adminUser.id,
        lines: {
          create: [
            {
              productId: prod1.id,
              quantity: 2,
              unitPrice: 1000,
              taxId: taxGst18.id,
              amount: 2000,
            },
            {
              productId: prod2.id,
              quantity: 1,
              unitPrice: 700,
              taxId: taxGst18.id,
              amount: 700,
            },
          ],
        },
      },
    });
  }

  // B. Quotation subscription for Globex
  let sub2 = await prisma.subscription.findUnique({ where: { number: "SUB-000002" } });
  if (!sub2) {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 14);

    sub2 = await prisma.subscription.create({
      data: {
        number: "SUB-000002",
        customerId: cust2.id,
        planId: planAnnual.id,
        status: "QUOTATION",
        startDate: new Date(),
        quotationValidUntil: validUntil,
        paymentTerms: "Net 30",
        createdById: staffUser.id,
        lines: {
          create: [
            {
              productId: prod1.id,
              quantity: 5,
              unitPrice: 3000,
              taxId: taxGst18.id,
              amount: 15000,
            },
          ],
        },
      },
    });
  }

  // C. Another active subscription for Wayne Enterprises (due today for billing demo)
  let sub3 = await prisma.subscription.findUnique({ where: { number: "SUB-000003" } });
  if (!sub3) {
    const dueToday = new Date();

    sub3 = await prisma.subscription.create({
      data: {
        number: "SUB-000003",
        customerId: cust3.id,
        planId: planMonthly.id,
        status: "ACTIVE",
        startDate: new Date("2025-01-01"),
        nextBillingDate: dueToday,
        paymentTerms: "Net 15",
        createdById: adminUser.id,
        lines: {
          create: [
            {
              productId: prod1.id,
              quantity: 1,
              unitPrice: 1560,
              taxId: taxGst18.id,
              amount: 1560,
            },
          ],
        },
      },
    });
  }

  // 11. Invoices & Payments (to populate dashboard with Paid, Outstanding, Overdue)
  // A. Paid Invoice
  let inv1 = await prisma.invoice.findUnique({ where: { number: "INV-000001" } });
  if (!inv1) {
    inv1 = await prisma.invoice.create({
      data: {
        number: "INV-000001",
        subscriptionId: sub1.id,
        customerId: cust1.id,
        status: "PAID",
        periodStart: new Date("2025-01-01"),
        periodEnd: new Date("2025-02-01"),
        issueDate: new Date("2025-01-01"),
        dueDate: new Date("2025-01-16"),
        subtotal: 2700,
        discountAmount: 270,
        discountId: discount10.id,
        taxAmount: 437.4,
        total: 2867.4,
        amountPaid: 2867.4,
        lines: {
          create: [
            {
              productId: prod1.id,
              description: "Business Software",
              quantity: 2,
              unitPrice: 1000,
              taxId: taxGst18.id,
              taxAmount: 360,
              amount: 2000,
            },
            {
              productId: prod2.id,
              description: "Cloud Server Hosting - RAM: 16GB",
              quantity: 1,
              unitPrice: 700,
              taxId: taxGst18.id,
              taxAmount: 126,
              amount: 700,
            },
          ],
        },
        payments: {
          create: {
            method: "CARD",
            amount: 2867.4,
            paidAt: new Date("2025-01-05"),
            note: "Paid via Corporate Visa",
            recordedById: adminUser.id,
          },
        },
      },
    });
  }

  // B. Outstanding (CONFIRMED, future dueDate) Invoice
  let inv2 = await prisma.invoice.findUnique({ where: { number: "INV-000002" } });
  if (!inv2) {
    const futureDue = new Date();
    futureDue.setDate(futureDue.getDate() + 10);

    inv2 = await prisma.invoice.create({
      data: {
        number: "INV-000002",
        subscriptionId: sub1.id,
        customerId: cust1.id,
        status: "CONFIRMED",
        periodStart: new Date("2025-02-01"),
        periodEnd: new Date("2025-03-01"),
        issueDate: new Date(),
        dueDate: futureDue,
        subtotal: 2700,
        discountAmount: 0,
        taxAmount: 486,
        total: 3186,
        amountPaid: 1000,
        lines: {
          create: [
            {
              productId: prod1.id,
              description: "Business Software",
              quantity: 2,
              unitPrice: 1000,
              taxId: taxGst18.id,
              taxAmount: 360,
              amount: 2000,
            },
            {
              productId: prod2.id,
              description: "Cloud Server Hosting - RAM: 16GB",
              quantity: 1,
              unitPrice: 700,
              taxId: taxGst18.id,
              taxAmount: 126,
              amount: 700,
            },
          ],
        },
        payments: {
          create: {
            method: "BANK_TRANSFER",
            amount: 1000,
            paidAt: new Date(),
            note: "Partial payment received",
            recordedById: staffUser.id,
          },
        },
      },
    });
  }

  // C. Overdue (CONFIRMED, dueDate in past) Invoice
  let inv3 = await prisma.invoice.findUnique({ where: { number: "INV-000003" } });
  if (!inv3) {
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 5);
    const pastIssue = new Date();
    pastIssue.setDate(pastIssue.getDate() - 20);

    inv3 = await prisma.invoice.create({
      data: {
        number: "INV-000003",
        subscriptionId: sub3.id,
        customerId: cust3.id,
        status: "CONFIRMED",
        periodStart: new Date("2024-12-01"),
        periodEnd: new Date("2025-01-01"),
        issueDate: pastIssue,
        dueDate: pastDue,
        subtotal: 1560,
        discountAmount: 0,
        taxAmount: 280.8,
        total: 1840.8,
        amountPaid: 0,
        lines: {
          create: [
            {
              productId: prod1.id,
              description: "Business Software - Edition: Odoo",
              quantity: 1,
              unitPrice: 1560,
              taxId: taxGst18.id,
              taxAmount: 280.8,
              amount: 1560,
            },
          ],
        },
      },
    });
  }

  console.log("Seeding complete! Admin, staff, customer, products, plans, subscriptions, and invoices created.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
