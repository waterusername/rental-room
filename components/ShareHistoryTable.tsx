import Link from "next/link";
import { Chip } from "@/components/Chip";
import { revokeUnitShareAction } from "@/lib/auth/share-actions";
import { formatUtc } from "@/lib/auth/http";
import type { UnitShareRecord } from "@/lib/auth/types";

const STATUS_LABEL = {
  active: "Active",
  revoked: "Revoked",
  expired: "Expired",
} as const;

export function ShareHistoryTable({ rows, empty }: { rows: UnitShareRecord[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-muted">{empty}</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel shadow-[var(--shadow)]">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="px-3 py-3 font-semibold">Unit</th>
            <th className="px-3 py-3 font-semibold">Created</th>
            <th className="px-3 py-3 font-semibold">Expires</th>
            <th className="px-3 py-3 font-semibold">Revoked</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 font-semibold">Views</th>
            <th className="px-3 py-3 font-semibold">Last opened</th>
            <th className="px-3 py-3 font-semibold">Revoke</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const status = row.status;
            return (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3">
                  <Link href={`/units/${row.unitId}`} className="font-semibold text-accent no-underline">
                    {row.unitLabel}
                  </Link>
                  <div className="text-xs text-muted">{row.unitId}</div>
                  <div className="text-xs text-muted">Link {row.id}</div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{formatUtc(row.createdAt)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatUtc(row.expiresAt)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatUtc(row.revokedAt)}</td>
                <td className="px-3 py-3">
                  <Chip tone={status === "active" ? "ok" : status === "revoked" ? "alert" : "wait"}>
                    {STATUS_LABEL[status]}
                  </Chip>
                </td>
                <td className="px-3 py-3">{row.viewCount}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatUtc(row.lastViewedAt)}</td>
                <td className="px-3 py-3">
                  {status === "active" ? (
                    <form action={revokeUnitShareAction}>
                      <input type="hidden" name="shareId" value={row.id} />
                      <input type="hidden" name="unitId" value={row.unitId} />
                      <button
                        type="submit"
                        className="inline-flex min-h-9 items-center justify-center rounded-full border border-warn-border bg-warn-soft px-3 text-xs font-semibold text-warn"
                      >
                        Revoke
                      </button>
                    </form>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
