import type { Metadata } from "next";
import Link from "next/link";
import { ShareHistoryTable } from "@/components/ShareHistoryTable";
import { requireUser } from "@/lib/auth/guards";
import { listSharesByUser } from "@/lib/auth/db";
import { paymentsEnforced, viewerCanBrowse } from "@/lib/auth/config";
import { BILLING_LABEL } from "@/lib/auth/types";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await requireUser();
  const stripeOn = paymentsEnforced();
  const canBrowse = viewerCanBrowse(session);
  const shares = await listSharesByUser(session.userId, 50);

  return (
    <>
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Your account</h1>
      <dl className="mt-6 space-y-3 rounded-lg border border-line bg-panel p-5 text-sm shadow-[var(--shadow)]">
        <Row label="Email" value={session.email} />
        <Row label="Name" value={session.name || "—"} />
        <Row label="Company" value={session.company || "—"} />
        <Row label="Role" value={session.role === "admin" ? "Administrator" : "Broker"} />
        <Row label="Billing" value={BILLING_LABEL[session.billingStatus]} />
      </dl>
      <p className="mt-4 text-sm leading-6 text-muted">
        {session.role === "admin"
          ? "Administrators can always open the vacancy boards."
          : canBrowse
            ? "This account can open the vacancy boards."
            : "The vacancy boards stay closed until billing is complimentary or the $100 USD monthly subscription is paid."}
        {stripeOn ? "" : " Payment collection is off on this server, so an active account is not blocked for billing."}
      </p>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">Your shares</h2>
        <p className="mt-2 text-sm text-muted">
          Units you sent with a single-unit link. This list is only yours.
          {session.role === "admin" ? " The access desk shows every broker." : ""}
        </p>
        <ShareHistoryTable rows={shares.rows} empty="You have not shared a unit yet." />
        {shares.total > shares.rows.length ? (
          <p className="mt-2 text-sm text-muted">Showing the latest 50 links.</p>
        ) : null}
      </section>
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/account/password" className="text-accent">
          Change password
        </Link>
        <Link href="/account/billing" className="text-accent">
          Billing
        </Link>
        {session.role === "admin" ? (
          <Link href="/admin" className="text-accent">
            Broker desk
          </Link>
        ) : null}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
