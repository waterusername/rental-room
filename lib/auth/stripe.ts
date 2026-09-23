import Stripe from "stripe";
import { mapStripeSubscriptionStatus } from "./config";
import { applyStripeBilling, findUserById } from "./db";
import type { BillingStatus, PublicUser } from "./types";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

export async function appBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "").split(",")[0]?.trim();
  const proto = (headerList.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim();
  if (!host) throw new Error("Set NEXT_PUBLIC_APP_URL to the public site address.");
  return `${proto}://${host}`;
}

export async function createCheckoutUrl(user: Pick<PublicUser, "id" | "email" | "stripeCustomerId">): Promise<string> {
  const stripe = getStripe();
  const price = process.env.STRIPE_PRICE_ID?.trim();
  if (!stripe || !price) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.");
  }
  const base = await appBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${base}/account/billing?checkout=success`,
    cancel_url: `${base}/account/billing?checkout=cancel`,
    client_reference_id: user.id,
    metadata: { userId: user.id },
    subscription_data: { metadata: { userId: user.id } },
    allow_promotion_codes: true,
    ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
  });
  if (!session.url) throw new Error("Stripe did not return a checkout link.");
  return session.url;
}

export async function applyStripeEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id || session.metadata?.userId || null;
    const customerId = idOf(session.customer);
    const subscriptionId = idOf(session.subscription);
    let billing: BillingStatus = session.payment_status === "unpaid" ? "payment_required" : "active_paid";
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      billing = mapStripeSubscriptionStatus(subscription.status);
    }
    await applyStripeBilling({ userId, customerId, subscriptionId, billingStatus: billing });
    return;
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    await applyStripeBilling({
      userId: subscription.metadata?.userId || null,
      customerId: idOf(subscription.customer),
      subscriptionId: subscription.id,
      billingStatus:
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : mapStripeSubscriptionStatus(subscription.status),
    });
    return;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const subscriptionId = invoiceSubscriptionId(invoice);
    await applyStripeBilling({
      userId: invoice.metadata?.userId || null,
      customerId: idOf(invoice.customer),
      subscriptionId,
      billingStatus: event.type === "invoice.paid" ? "active_paid" : "past_due",
    });
  }
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as Stripe.Invoice & { subscription?: string | { id: string } | null }).subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object" && "id" in legacy) return legacy.id;
  const parent = invoice.parent?.subscription_details?.subscription;
  if (typeof parent === "string") return parent;
  if (parent && typeof parent === "object") return parent.id;
  return null;
}

export async function checkoutForUserId(userId: string): Promise<string> {
  const user = await findUserById(userId);
  if (!user || user.role !== "broker") throw new Error("Checkout is only available for a broker account.");
  return createCheckoutUrl(user);
}
