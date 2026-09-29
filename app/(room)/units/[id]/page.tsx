import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClaimUnitForm } from "@/components/ClaimUnitForm";
import { ShareUnitPanel } from "@/components/ShareUnitPanel";
import { UnitDetail } from "@/components/UnitDetail";
import { viewerCanBrowse } from "@/lib/auth/config";
import { getCurrentSession } from "@/lib/auth/guards";
import { displayedStatus } from "@/lib/board";
import { boardClaims } from "@/lib/claim-unit";
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
  const claimed = listing ? await boardClaims() : null;
  const reserved = Boolean(listing && claimed && isReservedListing(listing, claimed.ids));
  if (!listing || (reserved && session.role !== "admin")) {
    return { title: "Unit not found" };
  }
  return {
    title: `${listing.address} ${unitLabel(listing.unit)}`,
    description: `${displayedStatus(listing.status, sectionFor(listing, claimed?.ids))}. ${rentSummary(listing)}.`,
  };
}

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = findListing(id);
  if (!listing) notFound();

  const session = await getCurrentSession();
  const claimed = await boardClaims();
  const reserved = isReservedListing(listing, claimed.ids);
  const isAdmin = session?.role === "admin";
  if (reserved && !isAdmin) notFound();

  const canShare = Boolean(session && !session.mustResetPassword && viewerCanBrowse(session) && !reserved);
  const canClaim = Boolean(
    session?.role === "broker" && !session.mustResetPassword && viewerCanBrowse(session) && !reserved,
  );
  const unitTitle = `${listing.address}, ${unitLabel(listing.unit)}`;

  return (
    <UnitDetail
      listing={listing}
      section={sectionFor(listing, claimed.ids)}
      claim={isAdmin ? (claimed.byUnit[listing.id] ?? null) : null}
      notice={
        <>
          {canShare ? <ShareUnitPanel unitId={listing.id} unitTitle={unitTitle} /> : null}
          {canClaim ? <ClaimUnitForm unitId={listing.id} unitTitle={unitTitle} variant="page" /> : null}
        </>
      }
    />
  );
}
