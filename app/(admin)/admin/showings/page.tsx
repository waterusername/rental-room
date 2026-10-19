import type { Metadata } from "next";
import Link from "next/link";
import { ShowingTableRow } from "@/components/admin/ShowingTableRow";
import { requireAdmin } from "@/lib/auth/guards";
import { actorFromSession, listShowingsForActor } from "@/lib/auth/showings-service";
import { listUsers } from "@/lib/auth/db";
import { claimedUnitIds } from "@/lib/claim-unit";
import { unitLabel } from "@/lib/format";
import { apartmentBoardGroups, findListing, getListing, inventory, isReservedListing } from "@/lib/inventory";
import { showingBrokerLabel, summarizeBrokerShowings, SHOWING_TIME_ZONE, type ShowingRecord } from "@/lib/showings";

export const metadata: Metadata = {
  title: "Showings",
  robots: { index: false, follow: false },
};

export default async function ShowingsPage({
  searchParams,
}: {
  searchParams: Promise<{ broker?: string; unit?: string }>;
}) {
  const session = await requireAdmin();
  const query = await searchParams;
  const [listed, users, claimed] = await Promise.all([
    listShowingsForActor(actorFromSession(session), {}),
    listUsers(),
    claimedUnitIds(),
  ]);
  if (!("showings" in listed.body)) {
    return (
      <p role="alert" className="rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
        {listed.body.error}
      </p>
    );
  }
  const showings = listed.body.showings;
  const summary = summarizeBrokerShowings(
    showings,
    users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      active: user.active,
    })),
  );
  const broker = query.broker?.trim() ?? "";
  const unit = query.unit?.trim() ?? "";
  const rows = showings.filter((showing) => {
    if (broker && showing.userId !== broker) return false;
    if (unit && showing.unitId !== unit) return false;
    return true;
  });
  const unitOptions = unitChoices(showings);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Administrators only</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Showings</h1>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-accent">
          Broker access
        </Link>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
        Every showing logged from a unit page. Brokers only see and change their own. The counts below use{" "}
        {SHOWING_TIME_ZONE}: this week starts Monday at midnight, and this month is the calendar month. A broker with
        zeros is not showing units right now.
      </p>

      <h2 className="mt-8 font-serif text-2xl font-semibold">By broker</h2>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-panel shadow-[var(--shadow)]">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="px-3 py-3 font-semibold">Broker</th>
              <th className="px-3 py-3 font-semibold">This week</th>
              <th className="px-3 py-3 font-semibold">This month</th>
              <th className="px-3 py-3 font-semibold">All</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted">
                  No broker accounts yet.
                </td>
              </tr>
            ) : (
              summary.map((row) => (
                <tr key={row.userId} className="border-b border-line last:border-0">
                  <td className="px-3 py-3 font-semibold">
                    {showingBrokerLabel({ brokerName: row.name, userEmail: row.email })}
                    {row.active ? "" : " (disabled)"}
                  </td>
                  <td className={`px-3 py-3 font-semibold tabular-nums ${row.week === 0 ? "text-warn" : ""}`}>
                    {row.week}
                  </td>
                  <td className="px-3 py-3 tabular-nums">{row.month}</td>
                  <td className="px-3 py-3 tabular-nums">{row.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form method="get" className="mt-8 grid gap-3 rounded-lg border border-line bg-panel p-4 shadow-[var(--shadow)] sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-sm font-semibold">
          Broker
          <select name="broker" defaultValue={broker} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm font-normal">
            <option value="">All brokers</option>
            {summary.map((row) => (
              <option key={row.userId} value={row.userId}>
                {showingBrokerLabel({ brokerName: row.name, userEmail: row.email })}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Unit
          <select name="unit" defaultValue={unit} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm font-normal">
            <option value="">All units</option>
            {unitOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Filter
          </button>
          <Link
            href="/admin/showings"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink no-underline"
          >
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No showings match these filters.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-line bg-panel shadow-[var(--shadow)]">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-3 py-3 font-semibold">When</th>
                <th className="px-3 py-3 font-semibold">Unit</th>
                <th className="px-3 py-3 font-semibold">Broker</th>
                <th className="px-3 py-3 font-semibold">Prospect</th>
                <th className="px-3 py-3 font-semibold">Outcome</th>
                <th className="px-3 py-3 font-semibold">Note</th>
                <th className="px-3 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((showing) => (
                <ShowingTableRow
                  key={showing.id}
                  showing={showing}
                  unitLabel={labelForUnit(showing.unitId)}
                  unitHref={hrefForUnit(showing.unitId, claimed)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function unitChoices(showings: ShowingRecord[]): { id: string; label: string }[] {
  const ids = new Set<string>();
  for (const group of apartmentBoardGroups()) {
    for (const listing of group.listings) ids.add(listing.id);
  }
  for (const showing of showings) ids.add(showing.unitId);
  return [...ids]
    .map((id) => ({ id, label: labelForUnit(id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function labelForUnit(id: string): string {
  const listing =
    getListing(id) ?? inventory.listings.reserved.find((row) => row.id === id) ?? inventory.listings.apartments.find((row) => row.id === id);
  if (!listing) return id;
  return `${listing.address}, ${unitLabel(listing.unit)}`;
}

function hrefForUnit(id: string, claimed: Set<string>): string | null {
  const listing = findListing(id);
  if (!listing || isReservedListing(listing, claimed)) return null;
  return `/units/${listing.id}`;
}
