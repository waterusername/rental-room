import { comparableRent, statusLabel, unitGroup } from "./format";
import type { Filters, Listing } from "./types";

export function applyFilters(
  listings: Listing[],
  filters: Filters,
  tracked: Set<string>,
): Listing[] {
  const query = filters.q.trim().toLowerCase();
  return listings.filter((listing) => {
    if (query) {
      const haystack = [
        listing.address,
        listing.unit,
        listing.unitType,
        listing.zip,
        listing.status,
        listing.officeNotes,
        listing.notes,
        listing.prospect,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filters.status && statusLabel(listing.status) !== filters.status) return false;
    if (filters.unitType && unitGroup(listing) !== filters.unitType) return false;
    if (filters.zip && (listing.zip ?? "") !== filters.zip) return false;
    if (filters.nycha && listing.nycha !== filters.nycha) return false;
    if (filters.tour === "yes" && listing.tours.length === 0) return false;
    if (filters.tour === "no" && listing.tours.length > 0) return false;
    if (filters.tracked === "yes" && !tracked.has(listing.id)) return false;
    if (filters.rent) {
      const rent = comparableRent(listing);
      if (rent == null) return false;
      if (filters.rent === "over-3500") {
        if (rent <= 3500) return false;
      } else {
        const max = Number(filters.rent);
        if (!Number.isFinite(max) || rent > max) return false;
      }
    }
    return true;
  });
}

export function statusOptions(listings: Listing[]): string[] {
  return [...new Set(listings.map((listing) => statusLabel(listing.status)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function zipOptions(listings: Listing[]): string[] {
  return [...new Set(listings.map((listing) => listing.zip).filter((zip): zip is string => Boolean(zip)))].sort();
}
