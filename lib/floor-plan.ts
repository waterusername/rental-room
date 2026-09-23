import plans from "@/data/floor-plans.json";
import type { Listing } from "./types";

const byModel = plans as Record<string, string>;

export function matterportModelId(url: string): string | null {
  const match = url.match(/[?&]m=([^&#]+)/);
  return match?.[1] ?? null;
}

export function floorPlansFor(
  listing: Pick<Listing, "address" | "unit" | "tours">,
): { src: string; alt: string; caption: string | null }[] {
  const seen = new Set<string>();
  const plans: { src: string; alt: string; caption: string | null }[] = [];
  for (const tour of listing.tours) {
    const id = matterportModelId(tour.url);
    const src = id ? byModel[id] : undefined;
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const caption = tour.label?.trim() || null;
    plans.push({
      src,
      alt: caption
        ? `Floor plan of ${listing.address}, ${listing.unit} (${caption})`
        : `Floor plan of ${listing.address}, ${listing.unit}`,
      caption,
    });
  }
  return plans;
}
