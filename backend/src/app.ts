import "express-async-errors";
import cors from "cors";
import express from "express";
import { config } from "./config";
import { errorHandler } from "./middleware/error";
import auth from "./modules/auth/routes";
import users from "./modules/users/routes";
import customers from "./modules/customers/routes";
import products from "./modules/products/routes";
import plans from "./modules/plans/routes";
import quotationTemplates from "./modules/quotation-templates/routes";
import subscriptions from "./modules/subscriptions/routes";
import invoices from "./modules/invoices/routes";
import taxes from "./modules/taxes/routes";
import discounts from "./modules/discounts/routes";
import payments from "./modules/payments/routes";
import portal from "./modules/portal/routes";
import dashboard from "./modules/dashboard/routes";

export const app = express();
app.use(cors({ origin: config.clientUrl }));
app.use(express.json());
app.get("/api/v1/health", (_q, res) => res.json({ success: true, data: { status: "ok" } }));

const v1 = express.Router();
// Each module is mounted here ONCE. Members edit only their own module folders.
v1.use("/auth", auth); v1.use("/users", users); v1.use("/customers", customers);
v1.use("/products", products); v1.use("/plans", plans);
v1.use("/quotation-templates", quotationTemplates); v1.use("/subscriptions", subscriptions);
v1.use("/invoices", invoices); v1.use("/taxes", taxes); v1.use("/discounts", discounts);
v1.use("/payments", payments); v1.use("/portal", portal); v1.use("/dashboard", dashboard);
app.use("/api/v1", v1);
app.use(errorHandler);
