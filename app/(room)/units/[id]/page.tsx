import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareUnitPanel } from "@/components/ShareUnitPanel";
import { UnitDetail } from "@/components/UnitDetail";
import { viewerCanBrowse } from "@/lib/auth/config";
import { getCurrentSession } from "@/lib/auth/guards";
import { rentSummary, statusLabel, unitLabel } from "@/lib/format";
import { allListings, getListing } from "@/lib/inventory";

export function generateStaticParams() {
  return allListings().map((listing) => ({ id: listing.id }));
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
  const listing = getListing(id);
  if (!listing) return { title: "Unit not found" };
  return {
    title: `${listing.address} ${unitLabel(listing.unit)}`,
    description: `${statusLabel(listing.status)}. ${rentSummary(listing)}.`,
  };
}

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = getListing(id);
  if (!listing) notFound();

  const session = await getCurrentSession();
  const canShare = Boolean(session && !session.mustResetPassword && viewerCanBrowse(session));
  const unitTitle = `${listing.address}, ${unitLabel(listing.unit)}`;

  return (
    <UnitDetail
      listing={listing}
      notice={canShare ? <ShareUnitPanel unitId={listing.id} unitTitle={unitTitle} /> : null}
    />
  );
}
