import plans from "@/data/floor-plans.json";
import areas from "@/data/layout-sqft.json";
import type { Listing } from "./types";

const byModel = plans as Record<string, string>;
const sqftByModel = areas as Record<string, number>;

export function matterportModelId(url: string): string | null {
  const match = url.match(/[?&]m=([^&#]+)/);
  return match?.[1] ?? null;
}

export function floorPlansFor(
  listing: Pick<Listing, "address" | "unit" | "tours">,
): { src: string; alt: string; caption: string | null; sqft: number | null }[] {
  const seen = new Set<string>();
  const found: { src: string; alt: string; caption: string | null; sqft: number | null }[] = [];
  for (const tour of listing.tours) {
    const id = matterportModelId(tour.url);
    const src = id ? byModel[id] : undefined;
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const caption = tour.label?.trim() || null;
    const sqft = id != null && Number.isFinite(sqftByModel[id]) ? sqftByModel[id] : null;
    found.push({
      src,
      alt: caption
        ? `Floor plan of ${listing.address}, ${listing.unit} (${caption})`
        : `Floor plan of ${listing.address}, ${listing.unit}`,
      caption,
      sqft,
    });
  }
  return found;
}
