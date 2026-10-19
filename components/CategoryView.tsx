import { Browser } from "./Browser";
import { boardClaims } from "@/lib/claim-unit";
import { getCurrentSession } from "@/lib/auth/guards";
import { showingStatsForUnits } from "@/lib/auth/showings-service";
import { apartmentBoardGroups, categoryMeta, inventory, listingsFor } from "@/lib/inventory";
import { exteriorFor } from "@/lib/street-view";
import type { Category } from "@/lib/types";

export async function CategoryView({ category, notice }: { category: Category; notice?: string }) {
  const meta = categoryMeta(category);
  const isHome = category === "apartment";
  const [session, claimed] = await Promise.all([
    getCurrentSession(),
    isHome ? boardClaims() : Promise.resolve(null),
  ]);
  const groups = isHome ? apartmentBoardGroups(claimed?.ids) : undefined;
  const listings = groups ? groups.flatMap((group) => group.listings) : listingsFor(category);
  const showingStats = session?.role === "admin" ? await showingStatsForUnits(listings.map((listing) => listing.id)) : undefined;
  const withTour = listings.filter((listing) => listing.tours.length > 0).length;
  const availableCount = groups?.find((group) => group.id === "available")?.listings.length ?? 0;
  const comingCount = groups?.find((group) => group.id === "coming-up")?.listings.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        {isHome ? "Grinberg rental vacancies" : "Grinberg rental room"}
      </p>
      <h1 className="mt-2 max-w-3xl font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        {isHome ? "Find the unit. See the space." : meta.title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{meta.lede}</p>
      {notice ? (
        <p role="status" className="mt-4 max-w-2xl rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-sm text-accent">
          {notice}
        </p>
      ) : null}
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {isHome ? (
          <>
            <Stat label="Available" value={String(availableCount)} />
            <Stat label="Coming Up" value={String(comingCount)} />
            <Stat label="With a tour" value={String(withTour)} />
          </>
        ) : (
          <>
            <Stat label="In this list" value={String(listings.length)} />
            <Stat label="With a tour" value={String(withTour)} />
            <Stat label="Marked available" value={String(listings.filter((listing) => listing.status.toLowerCase().includes("available")).length)} />
          </>
        )}
      </dl>
      {isHome ? (
        <ul className="mt-4 max-w-2xl list-disc space-y-1 pl-5 text-sm text-muted">
          {inventory.contact.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      <Browser
        listings={listings}
        groups={groups}
        photos={Object.fromEntries(
          listings.map((listing) => {
            const photo = exteriorFor(listing);
            return [listing.id, photo];
          }),
        )}
        variant={isHome ? "apartment" : "inventory"}
        allowClaim={isHome && session?.role === "broker"}
        showingStats={showingStats}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-3 shadow-[var(--shadow)]">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-2xl font-semibold">{value}</dd>
    </div>
  );
}
