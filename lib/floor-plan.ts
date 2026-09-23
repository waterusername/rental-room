import plans from "@/data/floor-plans.json";
import type { Listing } from "./types";

const byModel = plans as Record<string, string>;

export function matterportModelId(url: string): string | null {
  const match = url.match(/[?&]m=([^&#]+)/);
  return match?.[1] ?? null;
}

export function floorPlanFor(
  listing: Pick<Listing, "category" | "address" | "unit" | "tours">,
): { src: string; alt: string } | null {
  if (listing.category !== "apartment") return null;
  for (const tour of listing.tours) {
    const id = matterportModelId(tour.url);
    const src = id ? byModel[id] : undefined;
    if (src) {
      return {
        src,
        alt: `Floor plan of ${listing.address}, ${listing.unit}`,
      };
    }
  }
  return null;
}
