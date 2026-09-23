import type { BillingStatus, Role } from "./types";

export const SESSION_COOKIE = "rr_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
export const LAST_SEEN_WRITE_MS = 1000 * 60 * 5;
export const FAILURE_WINDOW_MS = 1000 * 60 * 15;
export const MAX_FAILURES_PER_EMAIL = 8;
export const MAX_FAILURES_PER_IP = 30;

export function databaseConfig(): { url: string; authToken?: string } | null {
  const url = process.env.TURSO_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
  if (url) return { url, authToken };
  if (process.env.NODE_ENV !== "production") {
    return { url: "file:./data/auth.local.db" };
  }
  return null;
}

export function paymentsEnforced(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_PRICE_ID?.trim());
}

export function mapStripeSubscriptionStatus(status: string): BillingStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "active_paid";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "payment_required";
  }
}

export function canBrowseListings(
  user: { role: Role; billingStatus: BillingStatus },
  stripeOn: boolean,
): boolean {
  if (user.role === "admin") return true;
  if (!stripeOn) return true;
  return user.billingStatus === "complimentary" || user.billingStatus === "active_paid";
}

export function viewerCanBrowse(user: { role: Role; billingStatus: BillingStatus }): boolean {
  return canBrowseListings(user, paymentsEnforced());
}

export function adminEnvWarning(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email && !password) {
    return "ADMIN_EMAIL and ADMIN_PASSWORD are not set, so the first administrator cannot be created.";
  }
  if (!email || !password) {
    return "Set both ADMIN_EMAIL and ADMIN_PASSWORD to create the first administrator.";
  }
  if (password.length < 10) {
    return "ADMIN_PASSWORD must be at least 10 characters.";
  }
  return null;
}

export function postLoginPath(input: {
  mustResetPassword: boolean;
  role: Role;
  billingStatus: BillingStatus;
  nextPath: string;
  stripeOn: boolean;
}): string {
  if (input.mustResetPassword) {
    const next = encodeURIComponent(input.nextPath);
    return `/account/password?next=${next}`;
  }
  if (!canBrowseListings(input, input.stripeOn)) return "/account/billing";
  return input.nextPath;
}
