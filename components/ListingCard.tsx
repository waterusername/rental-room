import Image from "next/image";
import Link from "next/link";
import { Chip } from "./Chip";
import {
  formatDate,
  rentSummary,
  statusLabel,
  statusTone,
  unitLabel,
} from "@/lib/format";
import { exteriorFor } from "@/lib/street-view";
import type { Listing } from "@/lib/types";

export function ListingCard({ listing }: { listing: Listing }) {
  const name = `${listing.address}, ${unitLabel(listing.unit)}`;
  const photo = exteriorFor(listing);
  return (
    <li>
      <Link
        href={`/units/${listing.id}`}
        className={`flex h-full flex-col overflow-hidden rounded-lg border border-line bg-panel text-ink no-underline shadow-[var(--shadow)] transition hover:border-accent-border hover:bg-accent-soft/40 ${photo ? "" : "p-4"}`}
      >
        {photo ? (
          <div className="relative aspect-[16/10] bg-panel-2">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              className="object-cover"
              sizes="(min-width: 1280px) 360px, (min-width: 640px) 50vw, 100vw"
            />
            <span className="absolute bottom-2 left-2 rounded-full bg-[#1b3a31]/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              {photo.kind === "streetview" ? "Exterior" : "Map"}
            </span>
          </div>
        ) : null}
        <div className={photo ? "flex flex-1 flex-col p-4" : "contents"}>
        <div className="flex items-start justify-between gap-3">
          <Chip tone={statusTone(listing.status)}>{statusLabel(listing.status)}</Chip>
          <span className="text-xs font-semibold text-muted">{listing.zip ?? "Zip not listed"}</span>
        </div>
        <h2 className="mt-3 font-serif text-xl font-semibold leading-tight tracking-tight">
          {listing.address}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {unitLabel(listing.unit)}
          {listing.unitType ? ` · ${listing.unitType}` : ""}
        </p>
        <p className="mt-3 text-sm font-semibold">{rentSummary(listing)}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {listing.tours.length > 0 ? <li><Chip tone="ok">Has tour</Chip></li> : null}
          {listing.nycha === "YES" ? <li><Chip>NYCHA</Chip></li> : null}
          {listing.hpdTrustFund === "YES" ? <li><Chip>HPD / Trust Fund</Chip></li> : null}
          {listing.washerDryer === "YES" ? <li><Chip>W/D</Chip></li> : null}
          {listing.reservationDate ? (
            <li>
              <Chip>Reserved {formatDate(listing.reservationDate)}</Chip>
            </li>
          ) : null}
        </ul>
        <span className="sr-only">Open details for {name}</span>
        </div>
      </Link>
    </li>
  );
}
