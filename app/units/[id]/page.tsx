import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@/components/Chip";
import { TourViewer } from "@/components/TourViewer";
import {
  applyHref,
  formatDate,
  formatMoney,
  rentSummary,
  statusLabel,
  statusTone,
  telHref,
  unitLabel,
  utilitiesLabel,
} from "@/lib/format";
import { allListings, categoryMeta, getListing, inventory, trackerFor } from "@/lib/inventory";
import { exteriorFor } from "@/lib/street-view";

export function generateStaticParams() {
  return allListings().map((listing) => ({ id: listing.id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
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

  const meta = categoryMeta(listing.category);
  const tracker = trackerFor(listing);
  const note = uniqueNotes(listing.officeNotes, listing.notes);
  const title = `${listing.address}, ${unitLabel(listing.unit)}`;
  const photo = exteriorFor(listing);
  const extraTour =
    tracker?.tourUrl && !listing.tours.some((tour) => tour.url === tracker.tourUrl)
      ? tracker.tourUrl
      : null;

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href={meta.href} className="text-sm font-semibold text-accent">
        ← {meta.label}
      </Link>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        {meta.label}
        {listing.zip ? ` · ${listing.zip}` : ""}
      </p>
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
        {listing.address}
      </h1>
      <p className="mt-2 text-lg text-muted">
        {unitLabel(listing.unit)}
        {listing.unitType ? ` · ${listing.unitType}` : ""}
      </p>
      {photo ? (
        <figure className="mt-6 overflow-hidden rounded-lg border border-line bg-panel shadow-[var(--shadow)]">
          <div className="relative aspect-[16/10] bg-panel-2">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1152px) 1152px, 100vw"
            />
          </div>
          <figcaption className="border-t border-line px-4 py-2 text-xs text-muted">{photo.credit}</figcaption>
        </figure>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip tone={statusTone(listing.status)}>{statusLabel(listing.status)}</Chip>
        {listing.nycha === "YES" ? <Chip tone="ok">NYCHA</Chip> : null}
        {listing.nycha === "NO" ? <Chip>Not NYCHA</Chip> : null}
        {listing.hpdTrustFund === "YES" ? <Chip tone="ok">HPD / Trust Fund</Chip> : null}
        {listing.hpdTrustFund === "NO" ? <Chip>Not HPD / Trust Fund</Chip> : null}
        {listing.washerDryer === "YES" ? <Chip>Washer/dryer</Chip> : null}
        {listing.washerDryer === "NO" ? <Chip>No washer/dryer</Chip> : null}
        {listing.tourReady === "DONE" ? <Chip tone="ok">Tour marked ready</Chip> : null}
        {listing.utilitiesIncluded ? <Chip>{utilitiesLabel(listing.utilitiesIncluded)}</Chip> : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={applyHref(inventory.contact.applyEmail, listing)}
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-white no-underline hover:bg-accent-hover"
        >
          Apply by email
        </a>
        {inventory.contact.phones.map((phone) => (
          <a
            key={phone.number}
            href={telHref(phone.number)}
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink no-underline"
          >
            Call {phone.label}
          </a>
        ))}
      </div>

      <section className="mt-8" aria-labelledby="facts-heading">
        <h2 id="facts-heading" className="font-serif text-2xl font-semibold">
          Rents and facts
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listing.minRent != null ? <Fact label="Min rent" value={formatMoney(listing.minRent)} /> : null}
          {listing.targetRent != null ? <Fact label="Target rent" value={formatMoney(listing.targetRent)} /> : null}
          {listing.potentialRent != null ? (
            <Fact label="Potential rent" value={formatMoney(listing.potentialRent)} />
          ) : null}
          {listing.minRent == null && listing.targetRent == null && listing.potentialRent == null ? (
            <Fact label="Rent" value="Not listed" />
          ) : null}
          <Fact label="Status" value={statusLabel(listing.status)} />
          <Fact label="Zip" value={listing.zip ?? "Not listed"} />
          <Fact label="Unit type" value={listing.unitType || "Not listed"} />
          <Fact
            label="Days vacant"
            value={listing.daysVacant == null ? "Not listed" : String(listing.daysVacant)}
          />
          {listing.bedrooms != null ? <Fact label="Bedrooms" value={String(listing.bedrooms)} /> : null}
          {listing.baths != null ? <Fact label="Baths" value={String(listing.baths)} /> : null}
          {listing.reservationDate ? (
            <Fact label="Reservation date" value={formatDate(listing.reservationDate) ?? listing.reservationDate} />
          ) : null}
          {listing.daysSinceReservation != null ? (
            <Fact label="Days since reservation" value={String(listing.daysSinceReservation)} />
          ) : null}
          {listing.prospect ? <Fact label="Prospect" value={listing.prospect} /> : null}
        </dl>
      </section>

      <section className="mt-8" aria-labelledby="tour-heading">
        <h2 id="tour-heading" className="font-serif text-2xl font-semibold">
          Virtual tour
        </h2>
        {listing.tours.length > 0 ? (
          <div className="mt-4">
            <TourViewer tours={listing.tours} title={title} />
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-line bg-panel px-4 py-6 text-muted">
            No Matterport link is on file for this unit.
          </p>
        )}
        {extraTour ? (
          <p className="mt-3 text-sm">
            Residential tracker also lists{" "}
            <a href={extraTour} className="font-semibold text-accent" target="_blank" rel="noreferrer">
              another tour
            </a>
            .
          </p>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="font-serif text-2xl font-semibold">
          Office notes
        </h2>
        {note ? (
          <p className="mt-4 whitespace-pre-wrap rounded-lg border border-line bg-panel-2 px-4 py-4 text-sm leading-6">
            {note}
          </p>
        ) : (
          <p className="mt-4 text-muted">No office note on this row.</p>
        )}
      </section>

      {tracker ? (
        <section className="mt-8" aria-labelledby="tracker-heading">
          <h2 id="tracker-heading" className="font-serif text-2xl font-semibold">
            Residential tracker
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            This address is also on the residential tracker. It is not repeated as its own card on
            the apartment grid.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Tracker status" value={tracker.status ?? "Not listed"} />
            <Fact label="Reserved on tracker" value={tracker.reserved ? "Yes" : "No"} />
            <Fact label="Prospect" value={tracker.prospect ?? "Not listed"} />
            <Fact label="Tracker unit type" value={tracker.unitType || "Not listed"} />
            {tracker.rent != null ? <Fact label="Tracker rent" value={formatMoney(tracker.rent)} /> : null}
          </dl>
        </section>
      ) : null}
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function uniqueNotes(officeNotes: string | null, notes: string | null): string | null {
  const parts = [officeNotes, notes].map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return [...new Set(parts)].join("\n\n") || null;
}
