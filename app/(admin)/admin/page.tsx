import type { Metadata } from "next";
import Link from "next/link";
import { AccountTable } from "@/components/admin/AccountTable";
import { SHARE_RULES } from "@/lib/auth/share-risk";
import { loadDashboard } from "@/lib/auth/stats";

export const metadata: Metadata = {
  title: "Broker access",
  robots: { index: false, follow: false },
};

export default async function AdminHomePage() {
  const dashboard = await loadDashboard();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Administrators only</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Broker access</h1>
        </div>
        <Link
          href="/admin/brokers/new"
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-white no-underline hover:bg-accent-hover"
        >
          New broker
        </Link>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
        Times are UTC. Each successful sign-in stores the account, time, IP address, browser, and a short fingerprint of
        the browser plus language. Share-risk badges are heuristics for credential sharing. Disable the account or end
        its sessions from the account page.
      </p>
      {dashboard.stripeOn ? (
        <p className="mt-4 max-w-3xl rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-sm text-accent">
          Stripe is configured. Brokers can open the boards only when billing is Complimentary or Paid.
        </p>
      ) : (
        <p className="mt-4 max-w-3xl rounded-md border border-tan-border bg-tan-soft px-3 py-2 text-sm text-tan">
          Stripe is not configured. Billing status is saved, but it does not block an active account.
        </p>
      )}

      <h2 className="mt-8 font-serif text-2xl font-semibold">Brokers</h2>
      <AccountTable rows={dashboard.brokers} />

      <h2 className="mt-10 font-serif text-2xl font-semibold">Administrators</h2>
      <AccountTable rows={dashboard.admins} />

      <details className="mt-8 max-w-3xl rounded-lg border border-line bg-panel p-4 text-sm leading-6">
        <summary className="cursor-pointer font-semibold">How “Possible shared login” is decided</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          {SHARE_RULES.map((rule) => (
            <li key={rule.code}>
              <span className="font-semibold text-ink">{rule.title}. </span>
              {rule.detail}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
