# Shared Contract (change only via PR approved by all 3)

## Stack
Node 20 + Express + TypeScript (tsx) + Prisma (SQLite dev, Postgres-ready) + Zod | React + Vite + react-router | JWT auth.

## Conventions
- Base URL `/api/v1`, plural kebab-case resources, JSON camelCase, ids = cuid strings, dates = ISO 8601.
- Success: `{ success:true, data, meta? }`  Error: `{ success:false, error:{ code, message, details? } }`
- Error codes: VALIDATION_ERROR 400, UNAUTHORIZED 401, FORBIDDEN 403, NOT_FOUND 404, CONFLICT 409, NOT_IMPLEMENTED 501, INTERNAL_ERROR 500.
- Lists: `?page=1&limit=20` (max 100, use `paging()` helper) + filters (`?status=`, `?customerId=`). Indexes exist on status/customerId/dueDate/nextBillingDate.
- Auth: `Authorization: Bearer <jwt>`; use `requireAuth` then `requireRole(...)`. `/portal` routes MUST scope by `req.user.id -> Customer.userId`.
- Throw `AppError` helpers (`utils/errors.ts`); never hand-roll error JSON. Validate bodies with Zod.
- Statuses/enums: `/shared/constants.ts` only. Never hardcode strings elsewhere.

## Roles
ADMIN: everything incl. creating staff and config (products, plans, taxes, discounts). STAFF: customers, quotations, subscriptions, invoices, payments, dashboard (no config, no staff creation). CUSTOMER: `/portal/*` own data only.

## ER summary
User 1-0..1 Customer; Customer 1-* Subscription; Plan 1-* Subscription; Subscription 1-* SubscriptionLine (Product, ProductVariant?, Tax?);
Product 1-* ProductVariant; QuotationTemplate(Plan) 1-* QuotationTemplateLine; Subscription 1-* Invoice (unique subscriptionId+periodStart);
Invoice 1-* InvoiceLine, 1-* Payment, *-0..1 Discount; Discount targets a Product or whole Subscription.
A quotation = Subscription with status QUOTATION (no separate table). Full fields: `backend/prisma/schema.prisma`.

## Business rules (to implement)
- Subscription: DRAFT>QUOTATION>CONFIRMED>ACTIVE>CLOSED (`SUBSCRIPTION_TRANSITIONS`). Invoice: DRAFT>CONFIRMED>PAID (+CANCELLED).
- Variant price = product.salesPrice + variant.priceAdjustment. Plan.minQuantity enforced on lines.
- Invoice generation: ACTIVE subscriptions with nextBillingDate <= today; lines -> discount (active, in dates, usedCount < usageLimit, min rules; increment usedCount) -> tax per line; advance nextBillingDate in the SAME transaction. Unique(subscriptionId, periodStart) blocks double billing.
- Invoice becomes PAID when sum(payments) >= total. Overdue = CONFIRMED, dueDate < today, not paid.

## API routes (owner)
- M1: POST /auth/register|login|forgot-password|reset-password, GET /auth/me (DONE), POST /users/staff (DONE); /customers, /products (+/:id/variants), /plans (+/:id/close|pause|renew)
- M2: /quotation-templates, /subscriptions (+/:id/transition, /:id/generate-invoice), /invoices (+/generate-due, /:id/confirm|cancel|send|print), /taxes, /discounts
- M3: /payments (+/by-invoice/:invoiceId), /portal/{subscriptions,invoices,payments}, /dashboard/{summary,active-subscriptions,revenue,overdue-invoices}
Exact method/path/role list = stubs in `backend/src/modules/*/routes.ts`.

## Git
`main` protected. Branches: feature/member1-auth-products, feature/member2-subscriptions-billing, feature/member3-payments-dashboard.
Edit ONLY your module folders + your frontend pages. Schema/shared/app.ts changes: tiny separate PR to main; others rebase. Schema sections are commented by owner to reduce conflicts. Run `npm run db:push` after pulling.
