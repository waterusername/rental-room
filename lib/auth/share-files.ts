import { getListing } from "@/lib/inventory";
import { presentListing } from "@/lib/unit-view";
import type { Listing } from "@/lib/types";
import { readPublicImage } from "./public-asset";
import { readActiveShare } from "./db";

export function shareImageResponse(image: { body: Buffer; contentType: string } | null): Response {
  if (!image) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  return new Response(new Uint8Array(image.body), {
    status: 200,
    headers: {
      "Content-Type": image.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function readSharedUnitImage(
  token: string,
  select: (listing: Listing) => string | null,
): Promise<{ body: Buffer; contentType: string } | null> {
  const share = await readActiveShare(token);
  if (!share) return null;
  const listing = getListing(share.unitId);
  if (!listing) return null;
  const src = select(listing);
  if (!src) return null;
  return readPublicImage(src);
}

export function readSharedExterior(token: string) {
  return readSharedUnitImage(token, (listing) => presentListing(listing).photo?.src ?? null);
}

export function readSharedFloorPlan(token: string, index: number) {
  if (!Number.isInteger(index) || index < 0 || index > 99) return Promise.resolve(null);
  return readSharedUnitImage(token, (listing) => presentListing(listing).floorPlans[index]?.src ?? null);
}
