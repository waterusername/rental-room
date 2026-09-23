import { Browser } from "./Browser";
import { categoryMeta, inventory, listingsFor } from "@/lib/inventory";
import type { Category } from "@/lib/types";

export function CategoryView({ category }: { category: Category }) {
  const meta = categoryMeta(category);
  const listings = listingsFor(category);
  const withTour = listings.filter((listing) => listing.tours.length > 0).length;
  const available = listings.filter((listing) => listing.status.toLowerCase().includes("available")).length;
  const isHome = category === "apartment";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        {isHome ? "Grinberg rental vacancies" : "Grinberg rental room"}
      </p>
      <h1 className="mt-2 max-w-3xl font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        {isHome ? "Find the unit. See the space." : meta.title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{meta.lede}</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isHome ? (
          <>
            <Stat label="Apartments" value={String(inventory.listings.apartments.length)} />
            <Stat label="Commercial" value={String(inventory.listings.commercial.length)} />
            <Stat label="Garages" value={String(inventory.listings.garages.length)} />
            <Stat label="Storages" value={String(inventory.listings.storages.length)} />
          </>
        ) : (
          <>
            <Stat label="In this list" value={String(listings.length)} />
            <Stat label="With a tour" value={String(withTour)} />
            <Stat label="Marked available" value={String(available)} />
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
      <Browser listings={listings} variant={isHome ? "apartment" : "inventory"} />
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
