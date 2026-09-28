import Image from "next/image";
import Link from "next/link";
import { Chip } from "./Chip";
import { listingSqft } from "@/lib/floor-plan";
import {
  bathCount,
  bedCount,
  formatDate,
  rentSummary,
  statusLabel,
  statusTone,
  unitLabel,
} from "@/lib/format";
import type { ExteriorPhoto } from "@/lib/street-view";
import type { Listing } from "@/lib/types";

export function ListingCard({
  listing,
  photo,
}: {
  listing: Listing;
  photo: ExteriorPhoto | null;
}) {
  const name = `${listing.address}, ${unitLabel(listing.unit)}`;
  const facts = unitFacts(listing);
  return (
    <li>
      <Link
        href={`/units/${listing.id}`}
        className={`unit-card flex h-full flex-col overflow-hidden rounded-lg border border-line bg-panel text-ink no-underline shadow-[var(--shadow)] transition hover:border-accent-border hover:bg-accent-soft/40 ${photo ? "" : "p-4"}`}
      >
        {photo ? (
          <div className="relative isolate aspect-square bg-panel-2">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              className="object-cover"
              style={{ objectPosition: photo.objectPosition ?? "center" }}
              sizes="(min-width: 768px) 560px, 100vw"
            />
            <span className="absolute bottom-3 left-3 z-10 rounded-full bg-[#1b3a31]/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              {photo.kind === "map" ? "Map" : "Exterior"}
            </span>
            <div
              aria-hidden="true"
              className="unit-facts-overlay pointer-events-none absolute inset-0 z-20 flex flex-col justify-center bg-[#142820]/92 p-5 text-white opacity-0 transition-opacity duration-150"
            >
              <p className="font-serif text-2xl font-semibold leading-tight tracking-tight">{listing.address}</p>
              <p className="mt-2 text-sm">{unitLabel(listing.unit)}</p>
              <p className="mt-1 text-sm">{listing.zip ?? "Zip not listed"}</p>
              {facts.length > 0 ? (
                <dl className="mt-4 space-y-1.5 text-sm">
                  {facts.map((fact) => (
                    <div key={fact.label} className="flex items-baseline justify-between gap-4">
                      <dt className="text-white/80">{fact.label}</dt>
                      <dd className="font-semibold">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
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
          {facts.length > 0 ? (
            <p className="mt-3 text-sm font-semibold leading-5">
              {facts.map((fact) => `${fact.label} ${fact.value}`).join(" · ")}
            </p>
          ) : null}
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

function unitFacts(listing: Listing): { label: string; value: string }[] {
  const beds = bedCount(listing);
  const baths = bathCount(listing);
  const sqft = listingSqft(listing);
  const facts: { label: string; value: string }[] = [];
  if (beds === 0) facts.push({ label: "Bedrooms", value: "Studio" });
  else if (beds != null) facts.push({ label: "Bedrooms", value: String(beds) });
  if (baths != null) facts.push({ label: "Bathrooms", value: String(baths) });
  if (sqft != null) facts.push({ label: "SQFT", value: sqft.toLocaleString("en-US") });
  return facts;
}
