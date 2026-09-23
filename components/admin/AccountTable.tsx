import Link from "next/link";
import { Chip } from "@/components/Chip";
import { formatUtc } from "@/lib/auth/http";
import type { AccountStats } from "@/lib/auth/stats";
import { BILLING_LABEL } from "@/lib/auth/types";

export function AccountTable({ rows }: { rows: AccountStats[] }) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-muted">None yet.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel shadow-[var(--shadow)]">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="px-3 py-3 font-semibold">Account</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 font-semibold">Billing</th>
            <th className="px-3 py-3 font-semibold">Created</th>
            <th className="px-3 py-3 font-semibold">Logins</th>
            <th className="px-3 py-3 font-semibold">Last login</th>
            <th className="px-3 py-3 font-semibold">Last IP</th>
            <th className="px-3 py-3 font-semibold">IPs (30d)</th>
            <th className="px-3 py-3 font-semibold">Units shared</th>
            <th className="px-3 py-3 font-semibold">Share risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user.id} className="border-b border-line last:border-0">
              <td className="px-3 py-3">
                <Link href={`/admin/brokers/${row.user.id}`} className="font-semibold text-accent no-underline">
                  {row.user.name || row.user.email}
                </Link>
                <div className="text-muted">{row.user.email}</div>
                {row.user.company ? <div className="text-muted">{row.user.company}</div> : null}
              </td>
              <td className="px-3 py-3">
                <Chip tone={row.user.active ? "ok" : "alert"}>{row.user.active ? "Active" : "Disabled"}</Chip>
              </td>
              <td className="px-3 py-3">{BILLING_LABEL[row.user.billingStatus]}</td>
              <td className="px-3 py-3 whitespace-nowrap">{formatUtc(row.user.createdAt)}</td>
              <td className="px-3 py-3">{row.totalLogins}</td>
              <td className="px-3 py-3 whitespace-nowrap">{formatUtc(row.lastLoginAt)}</td>
              <td className="px-3 py-3 font-mono text-xs">{row.lastIp ?? "—"}</td>
              <td className="px-3 py-3">{row.distinctIps30}</td>
              <td className="px-3 py-3">
                {row.sharedUnits === 0 ? (
                  <span className="text-muted">None</span>
                ) : (
                  <>
                    {row.sharedUnits}
                    {row.shareLinks !== row.sharedUnits ? (
                      <span className="text-muted"> · {row.shareLinks} links</span>
                    ) : null}
                  </>
                )}
              </td>
              <td className="px-3 py-3">
                {row.flags.length > 0 ? (
                  <Chip tone="alert">Possible shared login</Chip>
                ) : (
                  <span className="text-muted">None</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
