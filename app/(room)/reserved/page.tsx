import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Browser } from "@/components/Browser";
import { boardClaims } from "@/lib/claim-unit";
import { getCurrentSession } from "@/lib/auth/guards";
import { apartmentBoardGroups } from "@/lib/inventory";
import { exteriorFor } from "@/lib/street-view";

export const metadata: Metadata = {
  title: "Reserved",
  description: "Apartments marked Reserve or Reserved. Administrators only.",
};

export default async function ReservedPage() {
  const session = await getCurrentSession();
  if (session?.role !== "admin") redirect("/");

  const claimed = await boardClaims();
  const group = apartmentBoardGroups(true, claimed.ids).find((item) => item.id === "reserved");
  const listings = group?.listings ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Administrators only</p>
      <h1 className="mt-2 max-w-3xl font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        Reserved
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Units marked Reserve or Reserved on the office sheet, and units a broker claimed from Available or Coming Up.
        Brokers do not see them on the board, and they are not shared. A claimed card names the broker.
      </p>
      {group ? (
        <Browser
          listings={listings}
          groups={[group]}
          showHeadings={false}
          photos={Object.fromEntries(listings.map((listing) => [listing.id, exteriorFor(listing)]))}
          variant="apartment"
          claims={claimed.byUnit}
        />
      ) : null}
    </div>
  );
}
