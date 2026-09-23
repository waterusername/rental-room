import manifest from "@/data/street-view-manifest.json";
import listingExteriors from "@/data/listing-exteriors.json";
import { addressKey } from "./address-key.mjs";
import type { Listing } from "./types";

export type ExteriorKind = "streetview" | "map" | "photo";

export type ExteriorPhoto = {
  src: string;
  kind: ExteriorKind;
  alt: string;
  credit: string;
  objectPosition?: string;
};

type Manifest = {
  photos: Record<string, ExteriorPhoto>;
};

const photos = (manifest as Manifest).photos ?? {};
const unitPhotos = (listingExteriors as Manifest).photos ?? {};

function present(photo: ExteriorPhoto): ExteriorPhoto {
  return {
    src: photo.src,
    kind: photo.kind,
    alt: photo.alt,
    credit: photo.credit,
    ...(photo.objectPosition ? { objectPosition: photo.objectPosition } : {}),
  };
}

export function exteriorFor(
  listing: Pick<Listing, "id" | "category" | "address">,
): ExteriorPhoto | null {
  if (listing.category !== "apartment") return null;
  const custom = unitPhotos[listing.id];
  if (custom?.src) return present(custom);
  const photo = photos[addressKey(listing.address)];
  if (!photo?.src) return null;
  return present(photo);
}

export function assertApartmentExteriors(listings: { id: string; address: string }[]) {
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const listing of listings) {
    if (unitPhotos[listing.id]?.src) continue;
    const key = addressKey(listing.address);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!photos[key]?.src) missing.push(listing.address);
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing exterior photo for ${missing.join(", ")}. Run: npm run streetview`,
    );
  }
}
