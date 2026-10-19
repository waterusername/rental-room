import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClaimUnitForm } from "@/components/ClaimUnitForm";
import { ShareUnitPanel } from "@/components/ShareUnitPanel";
import { ShowingLog } from "@/components/ShowingLog";
import { UnitDetail } from "@/components/UnitDetail";
import { viewerCanBrowse } from "@/lib/auth/config";
import { getCurrentSession } from "@/lib/auth/guards";
import { actorFromSession, listShowingsForActor } from "@/lib/auth/showings-service";
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
  if (!listing || reserved) {
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

  const [session, claimed] = await Promise.all([getCurrentSession(), boardClaims()]);
  if (isReservedListing(listing, claimed.ids)) notFound();

  const canUseBoards = Boolean(session && !session.mustResetPassword && viewerCanBrowse(session));
  const canClaim = Boolean(session?.role === "broker" && canUseBoards);
  const unitTitle = `${listing.address}, ${unitLabel(listing.unit)}`;
  const listed = canUseBoards && session
    ? await listShowingsForActor(actorFromSession(session), { unitId: listing.id })
    : null;
  const showings = listed && "showings" in listed.body ? listed.body.showings : [];

  return (
    <UnitDetail
      listing={listing}
      section={sectionFor(listing, claimed.ids)}
      notice={
        <>
          {canUseBoards ? <ShareUnitPanel unitId={listing.id} unitTitle={unitTitle} /> : null}
          {canUseBoards && session ? (
            <ShowingLog
              unitId={listing.id}
              viewerLabel={session.name?.trim() || session.email}
              showings={showings}
              showBroker={session.role === "admin"}
              currentUserId={session.userId}
              canEditEveryRow={session.role === "admin"}
            />
          ) : null}
          {canClaim ? <ClaimUnitForm unitId={listing.id} unitTitle={unitTitle} variant="page" /> : null}
        </>
      }
    />
  );
}
