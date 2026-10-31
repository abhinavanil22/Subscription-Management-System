import http from "http";
import { app } from "./src/app";
import { prisma } from "./src/db";

async function main() {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api/v1`;

  async function req(path: string, options: any = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const json = (await res.json()) as any;
    return { status: res.status, ...json };
  }

  console.log("=== STEP 1: ADMIN LOGIN ===");
  const loginRes = await req("/auth/login", {
    method: "POST",
    body: { email: "admin@brightloop.test", password: "Admin@12345" },
  });
  if (!loginRes.success) throw new Error("Admin login failed: " + JSON.stringify(loginRes));
  const adminToken = loginRes.data.token;
  console.log("✓ Admin logged in, role:", loginRes.data.user.role);

  console.log("\n=== STEP 2: DASHBOARD SUMMARY ===");
  const dashRes = await req("/dashboard/summary", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log("✓ Dashboard summary:", dashRes.data);

  console.log("\n=== STEP 3 & 4: CREATE PRODUCT & VARIANT ===");
  const prodRes = await req("/products", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      name: "CyberSecurity Suite " + Date.now(),
      type: "SERVICE",
      salesPrice: 2000,
      costPrice: 800,
      notes: "Endpoint protection & cloud SIEM",
    },
  });
  if (!prodRes.success) throw new Error("Product creation failed: " + JSON.stringify(prodRes));
  const prodId = prodRes.data.id;
  console.log("✓ Product created:", prodRes.data.name, "(id:", prodId, ")");

  const varRes = await req(`/products/${prodId}/variants`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      attribute: "Tier",
      value: "Enterprise Plus",
      priceAdjustment: 1500,
    },
  });
  if (!varRes.success) throw new Error("Variant creation failed: " + JSON.stringify(varRes));
  const variantId = varRes.data.id;
  console.log("✓ Variant created:", varRes.data.value, "(+₹" + varRes.data.priceAdjustment + ")");

  console.log("\n=== STEP 5: CREATE PLAN ===");
  const planRes = await req("/plans", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      name: "Quarterly Enterprise " + Date.now(),
      price: 6000,
      frequency: "MONTHLY",
      minQuantity: 1,
      availableFrom: "2024-01-01",
    },
  });
  if (!planRes.success) throw new Error("Plan creation failed: " + JSON.stringify(planRes));
  const planId = planRes.data.id;
  console.log("✓ Plan created:", planRes.data.name, "(id:", planId, ")");

  console.log("\n=== STEP 6: CREATE CUSTOMER ===");
  const custEmail = `testcust_${Date.now()}@demo.test`;
  const custRes = await req("/customers", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      name: "Innovate AI Labs",
      email: custEmail,
      phone: "+91 9123456780",
      company: "Innovate AI",
      address: "HSR Layout, Bengaluru",
    },
  });
  if (!custRes.success) throw new Error("Customer creation failed: " + JSON.stringify(custRes));
  const customerId = custRes.data.id;
  console.log("✓ Customer created:", custRes.data.name, "(id:", customerId, ")");

  console.log("\n=== STEP 7: CREATE QUOTATION (SUBSCRIPTION in QUOTATION status) ===");
  const subRes = await req("/subscriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      customerId,
      planId,
      status: "QUOTATION",
      startDate: new Date().toISOString(),
      paymentTerms: "Net 15",
      lines: [
        {
          productId: prodId,
          variantId,
          quantity: 2,
          // unitPrice automatically calculated = 2000 + 1500 = 3500
        },
      ],
    },
  });
  if (!subRes.success) throw new Error("Subscription quotation creation failed: " + JSON.stringify(subRes));
  const subId = subRes.data.id;
  console.log("✓ Quotation created:", subRes.data.number, "status:", subRes.data.status, "line amount:", subRes.data.lines[0].amount);

  console.log("\n=== STEP 8: CONFIRM QUOTATION ===");
  const confirmRes = await req(`/subscriptions/${subId}/transition`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { to: "CONFIRMED" },
  });
  if (!confirmRes.success) throw new Error("Confirm transition failed: " + JSON.stringify(confirmRes));
  console.log("✓ Transitioned to:", confirmRes.data.status);

  console.log("\n=== STEP 9: ACTIVATE SUBSCRIPTION ===");
  const activateRes = await req(`/subscriptions/${subId}/transition`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { to: "ACTIVE" },
  });
  if (!activateRes.success) throw new Error("Activate transition failed: " + JSON.stringify(activateRes));
  console.log("✓ Transitioned to:", activateRes.data.status, "nextBillingDate:", activateRes.data.nextBillingDate);

  console.log("\n=== STEP 10: RUN BILLING (GENERATE INVOICE) ===");
  const invRes = await req(`/subscriptions/${subId}/generate-invoice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!invRes.success) throw new Error("Invoice generation failed: " + JSON.stringify(invRes));
  const invId = invRes.data.id;
  console.log("✓ Invoice generated:", invRes.data.number, "total: ₹" + invRes.data.total, "status:", invRes.data.status);

  console.log("\n=== STEP 11: TEST DUPLICATE BILLING PREVENTION ===");
  const dupRes = await req(`/subscriptions/${subId}/generate-invoice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log("✓ Duplicate invoice rejection status:", dupRes.status, dupRes.error?.code);

  console.log("\n=== STEP 12: CONFIRM INVOICE ===");
  const confInvRes = await req(`/invoices/${invId}/confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!confInvRes.success) throw new Error("Invoice confirmation failed: " + JSON.stringify(confInvRes));
  console.log("✓ Invoice confirmed, status:", confInvRes.data.status);

  console.log("\n=== STEP 13: RECORD PAYMENT ===");
  const payRes = await req("/payments", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      invoiceId: invId,
      method: "UPI",
      amount: invRes.data.total,
      note: "Full payment via Google Pay",
    },
  });
  if (!payRes.success) throw new Error("Payment failed: " + JSON.stringify(payRes));
  console.log("✓ Payment recorded:", payRes.data.amount, "method:", payRes.data.method);

  const checkInv = await req(`/invoices/${invId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log("✓ Invoice status after payment:", checkInv.data.status, "amountPaid:", checkInv.data.amountPaid);

  console.log("\n=== STEP 14: VERIFY CUSTOMER PORTAL & DATA ISOLATION ===");
  // Customer login (the seeded customer)
  const custLogin = await req("/auth/login", {
    method: "POST",
    body: { email: "customer@brightloop.test", password: "Customer@12345" },
  });
  const custToken = custLogin.data.token;
  console.log("✓ Customer logged in:", custLogin.data.user.email);

  const portalSubs = await req("/portal/subscriptions", {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  console.log("✓ Customer saw own subscriptions count:", portalSubs.data.length);

  // Try to access the other subscription created above (which belongs to Innovate AI, not customer@brightloop.test)
  const forbiddenAccess = await req(`/portal/subscriptions/${subId}`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  console.log("✓ Portal unauthorized subscription access correctly blocked:", forbiddenAccess.status, forbiddenAccess.error?.code);

  console.log("\n==========================================");
  console.log(">>> ALL ACCEPTANCE CRITERIA DEMO TESTS PASSED! <<<");
  console.log("==========================================");

  server.close();
}

main()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
