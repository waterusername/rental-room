"use client";

import { useMemo, useState } from "react";
import { ListingCard } from "./ListingCard";
import { applyFilters, statusOptions, zipOptions } from "@/lib/filter";
import { UNIT_GROUP_LABEL, unitGroup, type UnitGroup } from "@/lib/format";
import { EMPTY_FILTERS, type Filters, type Listing, type TrackerRow } from "@/lib/types";
import { addressKey, unitKey } from "@/lib/match";

const UNIT_ORDER: UnitGroup[] = ["0", "1", "2", "3", "4", "5", "garage", "storage", "retail", "other"];

function trackedSet(listings: Listing[], tracker: TrackerRow[]): Set<string> {
  const keys = new Set(tracker.map((row) => `${addressKey(row.address)}|${unitKey(row.unit)}`));
  const ids = new Set<string>();
  for (const listing of listings) {
    if (keys.has(`${addressKey(listing.address)}|${unitKey(listing.unit)}`)) ids.add(listing.id);
  }
  return ids;
}

export function Browser({
  listings,
  tracker,
  showProgramFilters,
}: {
  listings: Listing[];
  tracker: TrackerRow[];
  showProgramFilters: boolean;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const tracked = useMemo(() => trackedSet(listings, tracker), [listings, tracker]);
  const shown = useMemo(
    () => applyFilters(listings, filters, tracked),
    [listings, filters, tracked],
  );
  const statuses = useMemo(() => statusOptions(listings), [listings]);
  const zips = useMemo(() => zipOptions(listings), [listings]);
  const groups = useMemo(() => {
    const present = new Set(listings.map((listing) => unitGroup(listing)));
    return UNIT_ORDER.filter((group) => present.has(group));
  }, [listings]);
  const active = Object.values(filters).some(Boolean);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section aria-labelledby="filters-heading" className="mt-8">
      <h2 id="filters-heading" className="sr-only">
        Filter listings
      </h2>
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
          {showProgramFilters ? (
            <Select
              label="NYCHA"
              value={filters.nycha}
              onChange={(value) => update("nycha", value)}
              options={[
                { value: "YES", label: "NYCHA yes" },
                { value: "NO", label: "NYCHA no" },
              ]}
            />
          ) : null}
          <Select
            label="Tour"
            value={filters.tour}
            onChange={(value) => update("tour", value)}
            options={[
              { value: "yes", label: "Has a tour" },
              { value: "no", label: "No tour link" },
            ]}
          />
          {showProgramFilters ? (
            <Select
              label="Residential tracker"
              value={filters.tracked}
              onChange={(value) => update("tracked", value)}
              options={[{ value: "yes", label: "Also on the tracker" }]}
            />
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            Showing {shown.length} of {listings.length}
          </p>
          {active ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="min-h-11 rounded-full border border-line px-4 text-sm font-semibold"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line bg-panel px-4 py-10 text-center text-muted">
          No listings match these filters.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </ul>
      )}
    </section>
  );
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
