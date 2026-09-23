import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrokerSecurityForms, EditBrokerForm } from "@/components/admin/BrokerForms";
import { Chip } from "@/components/Chip";
import { requireAdmin } from "@/lib/auth/guards";
import { formatUtc, summarizeUserAgent } from "@/lib/auth/http";
import { SHARE_RULES } from "@/lib/auth/share-risk";
import { loadBrokerDetail } from "@/lib/auth/stats";
import { paymentsEnforced } from "@/lib/auth/config";
import { isGrinbergAdminEmail } from "@/lib/auth/staff";
import { BILLING_LABEL } from "@/lib/auth/types";

export const metadata: Metadata = {
  title: "Broker",
  robots: { index: false, follow: false },
};

export default async function BrokerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [admin, detail] = await Promise.all([requireAdmin(), loadBrokerDetail(id)]);
  if (!detail) notFound();
  const { user } = detail;
  const officeAccount = isGrinbergAdminEmail(user.email);

  return (
    <>
      <Link href="/admin" className="text-sm font-semibold text-accent">
        ← Broker access
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        {user.role === "admin" ? "Administrator" : "Broker"}
      </p>
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{user.name || user.email}</h1>
      <p className="mt-2 text-muted">{user.email}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip tone={user.active ? "ok" : "alert"}>{user.active ? "Active" : "Disabled"}</Chip>
        <Chip tone={user.billingStatus === "active_paid" || user.billingStatus === "complimentary" ? "ok" : "wait"}>
          {BILLING_LABEL[user.billingStatus]}
        </Chip>
        {detail.flags.length > 0 ? <Chip tone="alert">Possible shared login</Chip> : null}
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Created" value={formatUtc(user.createdAt)} />
        <Stat label="Total sign-ins" value={String(detail.totalLogins)} />
        <Stat label="Last sign-in" value={formatUtc(detail.lastLoginAt)} />
        <Stat label="Last IP" value={detail.lastIp ?? "—"} />
        <Stat label="Distinct IPs, 7 days" value={String(detail.distinctIps7)} />
        <Stat label="Distinct IPs, 30 days" value={String(detail.distinctIps30)} />
        <Stat label="Failed attempts, 7 days" value={String(detail.failedLogins7)} />
      </dl>

      {detail.flags.length > 0 ? (
        <section className="mt-6 rounded-lg border border-warn-border bg-warn-soft p-4">
          <h2 className="font-semibold text-warn">Possible shared login</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-ink">
            {detail.flags.map((flag) => (
              <li key={flag.code}>{flag.summary}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-6 text-sm text-muted">No share-risk flags for this account right now.</p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <EditBrokerForm
          userId={user.id}
          email={user.email}
          name={user.name}
          company={user.company}
          billingStatus={user.billingStatus}
          officeAccount={officeAccount}
        />
        <BrokerSecurityForms
          userId={user.id}
          active={user.active}
          self={user.id === admin.userId}
          stripeOn={paymentsEnforced() && user.role === "broker" && !officeAccount}
        />
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">Sign-in history</h2>
        <p className="mt-2 text-sm text-muted">Successful sign-ins only. Times are UTC.</p>
        {detail.history.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No sign-ins recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel shadow-[var(--shadow)]">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-3 py-3 font-semibold">Time (UTC)</th>
                  <th className="px-3 py-3 font-semibold">IP</th>
                  <th className="px-3 py-3 font-semibold">Client</th>
                  <th className="px-3 py-3 font-semibold">Fingerprint</th>
                </tr>
              </thead>
              <tbody>
                {detail.history.map((event) => (
                  <tr key={event.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-3 whitespace-nowrap">{formatUtc(event.occurredAt)}</td>
                    <td className="px-3 py-3 font-mono text-xs">{event.ip ?? "—"}</td>
                    <td className="px-3 py-3" title={event.userAgent ?? undefined}>
                      {summarizeUserAgent(event.userAgent)}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{event.fingerprint ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {detail.historyTruncated ? (
          <p className="mt-2 text-sm text-muted">Showing the latest 200 sign-ins.</p>
        ) : null}
      </section>

      <details className="mt-8 rounded-lg border border-line bg-panel p-4 text-sm leading-6">
        <summary className="cursor-pointer font-semibold">Flag rules</summary>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-3 shadow-[var(--shadow)]">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 break-all text-sm font-semibold">{value}</dd>
    </div>
  );
}
