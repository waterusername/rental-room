import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareUnitPanel } from "@/components/ShareUnitPanel";
import { UnitDetail } from "@/components/UnitDetail";
import { viewerCanBrowse } from "@/lib/auth/config";
import { listActiveUnitShares } from "@/lib/auth/db";
import { getCurrentSession } from "@/lib/auth/guards";
import { formatUtc } from "@/lib/auth/http";
import { SHARE_TTL_DAYS } from "@/lib/auth/share-access";
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
  let links: {
    id: string;
    createdLabel: string;
    expiresLabel: string;
    viewCount: number;
    createdByEmail: string;
  }[] = [];
  let loadError: string | null = null;
  if (canShare && session) {
    try {
      const rows = await listActiveUnitShares({
        unitId: listing.id,
        actorUserId: session.userId,
        actorIsAdmin: session.role === "admin",
      });
      links = rows.map((row) => ({
        id: row.id,
        createdLabel: formatUtc(row.createdAt),
        expiresLabel: formatUtc(row.expiresAt),
        viewCount: row.viewCount,
        createdByEmail: row.createdByEmail,
      }));
    } catch (error) {
      console.error("Share list failed", error instanceof Error ? error.message : "unknown");
      loadError = "Share links are unavailable right now.";
    }
  }

  const unitTitle = `${listing.address}, ${unitLabel(listing.unit)}`;

  return (
    <UnitDetail
      listing={listing}
      notice={
        canShare ? (
          <ShareUnitPanel
            unitId={listing.id}
            unitTitle={unitTitle}
            ttlDays={SHARE_TTL_DAYS}
            links={links}
            showCreator={session?.role === "admin"}
            loadError={loadError}
          />
        ) : null
      }
    />
  );
}
