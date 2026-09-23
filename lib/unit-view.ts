import { categoryMeta } from "./categories";
import { unitLabel } from "./format";
import { floorPlansFor } from "./floor-plan";
import { trackerFor } from "./inventory";
import { exteriorFor } from "./street-view";
import type { Listing, Tour } from "./types";

export function presentListing(listing: Listing) {
  const meta = categoryMeta(listing.category);
  const tracker = trackerFor(listing);
  const note = uniqueNotes(listing.officeNotes, listing.notes);
  const title = `${listing.address}, ${unitLabel(listing.unit)}`;
  const photo = exteriorFor(listing);
  const tours = mergeTrackerTour(listing.tours, tracker?.tourUrl ?? null);
  const floorPlans = floorPlansFor({ ...listing, tours });
  return { meta, note, title, photo, tours, floorPlans };
}

function mergeTrackerTour(tours: Tour[], tourUrl: string | null): Tour[] {
  if (!tourUrl || tours.some((tour) => tour.url === tourUrl)) return tours;
  return [...tours, { url: tourUrl, label: "Additional tour" }];
}

function uniqueNotes(officeNotes: string | null, notes: string | null): string | null {
  const parts = [officeNotes, notes].map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return [...new Set(parts)].join("\n\n") || null;
}
