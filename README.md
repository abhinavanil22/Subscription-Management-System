# Brightloop Subscription Management (MVP foundation)
Shared contract (API, roles, ER, statuses, git rules): `docs/CONTRACT.md`

## Run
```bash
# Backend
cd backend && cp ../.env.example .env && npm install
npm run db:push && npm run db:seed && npm run dev     # http://localhost:4000/api/v1/health
# Frontend (new terminal)
cd frontend && cp ../.env.example .env && npm install && npm run dev   # http://localhost:5173
```
Admin login: `admin@brightloop.test` / `Admin@12345`. Password-reset link prints in the backend console (dev).

## Layout
`shared/` enums+types | `backend/src/modules/<name>/routes.ts` | `backend/prisma/schema.prisma` | `frontend/src/pages` | `docs/`

## Ownership
M1 auth/users/customers/products/plans | M2 quotations/subscriptions/invoices/taxes/discounts | M3 payments/portal/dashboard.
Unbuilt endpoints return 501 NOT_IMPLEMENTED.
