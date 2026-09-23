"use client";

import { useMemo, useState } from "react";
import { ListingCard } from "./ListingCard";
import { applyFilters, statusOptions, zipOptions } from "@/lib/filter";
import {
  UNIT_GROUP_LABEL,
  bathroomOptionLabel,
  bedroomOptionLabel,
  bathCount,
  bedCount,
  countKey,
  unitGroup,
  type UnitGroup,
} from "@/lib/format";
import { EMPTY_FILTERS, type Filters, type Listing } from "@/lib/types";

const UNIT_ORDER: UnitGroup[] = ["0", "1", "2", "3", "4", "5", "garage", "storage", "retail", "other"];

export function Browser({
  listings,
  photos,
  variant,
}: {
  listings: Listing[];
  photos: Record<string, { src: string; kind: "streetview" | "map"; alt: string; credit: string } | null>;
  variant: "apartment" | "inventory";
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const shown = useMemo(() => applyFilters(listings, filters), [listings, filters]);
  const active = Object.values(filters).some(Boolean);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section aria-labelledby="filters-heading" className="mt-8">
      <h2 id="filters-heading" className="sr-only">
        Filter listings
      </h2>
      {variant === "apartment" ? (
        <ApartmentFilters
          listings={listings}
          filters={filters}
          update={update}
          shown={shown.length}
          active={active}
          onClear={() => setFilters(EMPTY_FILTERS)}
        />
      ) : (
        <InventoryFilters
          listings={listings}
          filters={filters}
          update={update}
          shown={shown.length}
          active={active}
          onClear={() => setFilters(EMPTY_FILTERS)}
        />
      )}

      {shown.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line bg-panel px-4 py-10 text-center text-muted">
          No listings match these filters.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((listing) => (
            <ListingCard key={listing.id} listing={listing} photo={photos[listing.id] ?? null} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ApartmentFilters({
  listings,
  filters,
  update,
  shown,
  active,
  onClear,
}: {
  listings: Listing[];
  filters: Filters;
  update: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  shown: number;
  active: boolean;
  onClear: () => void;
}) {
  const bedrooms = useMemo(
    () => countOptions(listings, bedCount, bedroomOptionLabel),
    [listings],
  );
  const bathrooms = useMemo(
    () => countOptions(listings, bathCount, bathroomOptionLabel),
    [listings],
  );

  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-[var(--shadow)]">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Search</span>
          <input
            type="search"
            value={filters.q}
            onChange={(event) => update("q", event.target.value)}
            placeholder="Address or unit"
            className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
          />
        </label>
        <Select
          label="Bedrooms"
          value={filters.beds}
          onChange={(value) => update("beds", value)}
          options={bedrooms}
        />
        <Select
          label="Bathrooms"
          value={filters.baths}
          onChange={(value) => update("baths", value)}
          options={bathrooms}
        />
      </div>
      <FilterFooter shown={shown} total={listings.length} active={active} onClear={onClear} />
    </div>
  );
}

function InventoryFilters({
  listings,
  filters,
  update,
  shown,
  active,
  onClear,
}: {
  listings: Listing[];
  filters: Filters;
  update: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  shown: number;
  active: boolean;
  onClear: () => void;
}) {
  const statuses = useMemo(() => statusOptions(listings), [listings]);
  const zips = useMemo(() => zipOptions(listings), [listings]);
  const groups = useMemo(() => {
    const present = new Set(listings.map((listing) => unitGroup(listing)));
    return UNIT_ORDER.filter((group) => present.has(group));
  }, [listings]);

  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-[var(--shadow)]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-2 lg:col-span-4">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Search</span>
          <input
            type="search"
            value={filters.q}
            onChange={(event) => update("q", event.target.value)}
            placeholder="Address, unit, zip, notes"
            className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
          />
        </label>
        <Select
          label="Status"
          value={filters.status}
          onChange={(value) => update("status", value)}
          options={statuses.map((status) => ({ value: status, label: status }))}
        />
        <Select
          label="Unit type"
          value={filters.unitType}
          onChange={(value) => update("unitType", value)}
          options={groups.map((group) => ({ value: group, label: UNIT_GROUP_LABEL[group] }))}
        />
        <Select
          label="Zip"
          value={filters.zip}
          onChange={(value) => update("zip", value)}
          options={zips.map((zip) => ({ value: zip, label: zip }))}
        />
        <Select
          label="Rent"
          value={filters.rent}
          onChange={(value) => update("rent", value)}
          options={[
            { value: "2000", label: "$2,000 or less" },
            { value: "2500", label: "$2,500 or less" },
            { value: "3000", label: "$3,000 or less" },
            { value: "3500", label: "$3,500 or less" },
            { value: "over-3500", label: "Over $3,500" },
          ]}
        />
        <Select
          label="Tour"
          value={filters.tour}
          onChange={(value) => update("tour", value)}
          options={[
            { value: "yes", label: "Has a tour" },
            { value: "no", label: "No tour link" },
          ]}
        />
      </div>
      <FilterFooter shown={shown} total={listings.length} active={active} onClear={onClear} />
    </div>
  );
}

function FilterFooter({
  shown,
  total,
  active,
  onClear,
}: {
  shown: number;
  total: number;
  active: boolean;
  onClear: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted" aria-live="polite">
        Showing {shown} of {total}
      </p>
      {active ? (
        <button
          type="button"
          onClick={onClear}
          className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

function countOptions(
  listings: Listing[],
  pick: (listing: Listing) => number | null,
  label: (key: string) => string,
) {
  const keys = new Set<string>();
  for (const listing of listings) {
    const key = countKey(pick(listing));
    if (key) keys.add(key);
  }
  return [...keys]
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => ({ value: key, label: label(key) }));
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
