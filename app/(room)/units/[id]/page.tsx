import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareUnitPanel } from "@/components/ShareUnitPanel";
import { UnitDetail } from "@/components/UnitDetail";
import { viewerCanBrowse } from "@/lib/auth/config";
import { getCurrentSession } from "@/lib/auth/guards";
import { displayedStatus } from "@/lib/board";
import { rentSummary, unitLabel } from "@/lib/format";
import { findListing, isReservedListing, routableListings, sectionFor } from "@/lib/inventory";

export function generateStaticParams() {
  return routableListings().map((listing) => ({ id: listing.id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await getCurrentSession();
  if (!session || session.mustResetPassword || !viewerCanBrowse(session)) {
    return { title: "Sign in" };
  }
  const { id } = await params;
  const listing = findListing(id);
  if (!listing || (isReservedListing(listing) && session.role !== "admin")) {
    return { title: "Unit not found" };
  }
  return {
    title: `${listing.address} ${unitLabel(listing.unit)}`,
    description: `${displayedStatus(listing.status, sectionFor(listing))}. ${rentSummary(listing)}.`,
  };
}

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = findListing(id);
  if (!listing) notFound();

  const session = await getCurrentSession();
  if (isReservedListing(listing) && session?.role !== "admin") notFound();
  const canShare = Boolean(
    session && !session.mustResetPassword && viewerCanBrowse(session) && !isReservedListing(listing),
  );
  const unitTitle = `${listing.address}, ${unitLabel(listing.unit)}`;

  return (
    <UnitDetail
      listing={listing}
      notice={canShare ? <ShareUnitPanel unitId={listing.id} unitTitle={unitTitle} /> : null}
    />
  );
}
