export const ROLES = ["admin", "broker"] as const;
export type Role = (typeof ROLES)[number];

export const BILLING_STATUSES = [
  "complimentary",
  "payment_required",
  "active_paid",
  "past_due",
  "canceled",
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const BILLING_LABEL: Record<BillingStatus, string> = {
  complimentary: "Complimentary",
  payment_required: "Payment required",
  active_paid: "Paid",
  past_due: "Past due",
  canceled: "Canceled",
};

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  role: Role;
  active: boolean;
  mustResetPassword: boolean;
  billingStatus: BillingStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  termsAcceptedAt: string | null;
  selfSignup: boolean;
};

export type UserRecord = PublicUser & {
  passwordHash: string;
};

export type AuthSession = {
  sessionId: string;
  userId: string;
  email: string;
  name: string | null;
  company: string | null;
  role: Role;
  mustResetPassword: boolean;
  billingStatus: BillingStatus;
  selfSignup: boolean;
  expiresAt: string;
};

export type RequestMeta = {
  ip: string;
  userAgent: string;
  acceptLanguage: string;
  fingerprint: string;
};

export type LoginState = {
  error?: string;
} | null;

export type ActionState = {
  error?: string;
  ok?: string;
  tempPassword?: string;
  checkoutUrl?: string;
  emailTaken?: boolean;
} | null;

export type LoginHistoryRow = {
  id: string;
  occurredAt: string;
  ip: string | null;
  userAgent: string | null;
  fingerprint: string | null;
};
