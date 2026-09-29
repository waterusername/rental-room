import type { Metadata } from "next";
import Link from "next/link";
import { AddCompletedRentalForm, DeleteCompletedRentalButton } from "@/components/admin/CompletedRentalForms";
import { listCompletedRentals } from "@/lib/auth/db";
import { formatCompletedMoney } from "@/lib/completed-rentals";

export const metadata: Metadata = {
  title: "Completed rentals",
  robots: { index: false, follow: false },
};

export default async function CompletedRentalsPage() {
  const rows = await listCompletedRentals();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Administrators only</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Completed rentals</h1>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-accent">
          Broker access
        </Link>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
        Finished deals for the Grinberg office, including move-ins. Property, company, and notes are the record. Rent
        amount, fee to collect, and other amount are optional figures from the office sheet.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No completed rentals yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-line bg-panel shadow-[var(--shadow)]">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-3 py-3 font-semibold">Property</th>
                <th className="px-3 py-3 font-semibold">Company</th>
                <th className="px-3 py-3 font-semibold">Notes</th>
                <th className="px-3 py-3 font-semibold">Rent amount</th>
                <th className="px-3 py-3 font-semibold">Fee to collect</th>
                <th className="px-3 py-3 font-semibold">Other amount</th>
                <th className="px-3 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-3 py-3 font-semibold">
                    <Link href={`/admin/completed/${row.id}`} className="text-accent no-underline">
                      {row.property}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{row.company || "—"}</td>
                  <td className="max-w-xs px-3 py-3 whitespace-pre-wrap">{row.notes || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatCompletedMoney(row.rentCents)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatCompletedMoney(row.feeToCollectCents)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatCompletedMoney(row.otherAmountCents)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/admin/completed/${row.id}`} className="font-semibold text-accent no-underline">
                        Edit
                      </Link>
                      <DeleteCompletedRentalButton id={row.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddCompletedRentalForm />
    </>
  );
}
