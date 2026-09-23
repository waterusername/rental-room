import type { Metadata } from "next";
import { CheckoutButton } from "@/components/auth/CheckoutButton";
import { paymentsEnforced, viewerCanBrowse } from "@/lib/auth/config";
import { requireUser } from "@/lib/auth/guards";
import { BILLING_LABEL } from "@/lib/auth/types";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await requireUser();
  if (session.mustResetPassword) {
    const { redirect } = await import("next/navigation");
    redirect("/account/password");
  }
  const params = await searchParams;
  const stripeOn = paymentsEnforced();
  const canBrowse = viewerCanBrowse(session);
  const needsPayment =
    session.role === "broker" &&
    stripeOn &&
    session.billingStatus !== "complimentary" &&
    session.billingStatus !== "active_paid";

  return (
    <>
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Status: <span className="font-semibold text-ink">{BILLING_LABEL[session.billingStatus]}</span>.
        {session.role === "admin"
          ? " Administrator access does not depend on a subscription."
          : canBrowse
            ? " You can open the vacancy boards."
            : " The vacancy boards stay closed until this account is complimentary or the $100 USD monthly subscription is paid."}
      </p>
      {params.checkout === "success" ? (
        <p className="mt-4 rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-sm text-accent">
          Stripe checkout finished. Access updates when the webhook marks the subscription active, usually within a minute.
        </p>
      ) : null}
      {params.checkout === "cancel" ? (
        <p className="mt-4 rounded-md border border-tan-border bg-tan-soft px-3 py-2 text-sm text-tan">
          Checkout was canceled. No charge was made from this page.
        </p>
      ) : null}
      {!stripeOn ? (
        <p className="mt-4 text-sm leading-6 text-muted">
          Stripe is not configured on this server. Active accounts are not blocked for payment.
        </p>
      ) : null}
      {needsPayment ? <CheckoutButton /> : null}
    </>
  );
}
