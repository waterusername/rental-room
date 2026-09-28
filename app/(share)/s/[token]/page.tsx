import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareClosed } from "@/components/ShareClosed";
import { UnitDetail } from "@/components/UnitDetail";
import { readShareGate, recordShareView } from "@/lib/auth/db";
import { isShareToken } from "@/lib/auth/share-access";
import { unitLabel } from "@/lib/format";
import { getListing } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const closed = { title: "Link unavailable", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
  if (!isShareToken(token)) return closed;
  try {
    const gate = await readShareGate(token);
    if (gate.status === "expired") return { ...closed, title: "Link expired" };
    if (gate.status === "revoked") return { ...closed, title: "Link revoked" };
    if (gate.status !== "open") return closed;
    const listing = getListing(gate.share.unitId);
    if (!listing) return closed;
    return {
      title: `${listing.address} ${unitLabel(listing.unit)}`,
      description: "A single Grinberg unit shared with you.",
      robots: { index: false, follow: false },
      referrer: "no-referrer",
    };
  } catch (error) {
    console.error("Share metadata failed", error instanceof Error ? error.message : "unknown");
    return closed;
  }
}

export default async function SharedUnitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isShareToken(token)) notFound();

  let gate: Awaited<ReturnType<typeof readShareGate>> = { status: "unavailable" };
  try {
    gate = await readShareGate(token);
  } catch (error) {
    console.error("Share lookup failed", error instanceof Error ? error.message : "unknown");
    notFound();
  }
  if (gate.status === "expired" || gate.status === "revoked") return <ShareClosed reason={gate.status} />;
  if (gate.status !== "open") notFound();
  const share = gate.share;

  const listing = getListing(share.unitId);
  if (!listing) notFound();

  try {
    await recordShareView(share.id);
  } catch (error) {
    console.error("Share view count failed", error instanceof Error ? error.message : "unknown");
  }

  return <UnitDetail listing={listing} assetBase={`/s/${token}`} showBackLink={false} />;
}
