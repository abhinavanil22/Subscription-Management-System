// SHARED CONTRACT - used by backend and frontend. Change only via PR reviewed by all 3 members.
export const ROLES = ["ADMIN", "STAFF", "CUSTOMER"] as const;
export const PRODUCT_TYPES = ["SERVICE", "GOODS"] as const; // TODO: confirm types with team
export const BILLING_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export const PLAN_STATUSES = ["ACTIVE", "PAUSED", "CLOSED"] as const;
export const SUBSCRIPTION_STATUSES = ["DRAFT", "QUOTATION", "CONFIRMED", "ACTIVE", "CLOSED"] as const;
export const INVOICE_STATUSES = ["DRAFT", "CONFIRMED", "PAID", "CANCELLED"] as const;
export const DISCOUNT_TYPES = ["FIXED", "PERCENTAGE"] as const;
export const DISCOUNT_SCOPES = ["PRODUCT", "SUBSCRIPTION"] as const;
export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CARD", "UPI", "OTHER"] as const;

export type Role = (typeof ROLES)[number];
export type BillingFrequency = (typeof BILLING_FREQUENCIES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// Allowed lifecycle transitions (enforce in services)
export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  DRAFT: ["QUOTATION"], QUOTATION: ["CONFIRMED"], CONFIRMED: ["ACTIVE"], ACTIVE: ["CLOSED"], CLOSED: [],
};
export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PAID", "CANCELLED"], PAID: [], CANCELLED: [],
};

export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/; // >8 chars, upper, lower, special

export interface ApiOk<T> { success: true; data: T; meta?: { page: number; limit: number; total: number } }
export interface ApiErr { success: false; error: { code: string; message: string; details?: unknown } }
export type ApiResponse<T> = ApiOk<T> | ApiErr;
