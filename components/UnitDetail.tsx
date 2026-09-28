import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { TourViewer } from "@/components/TourViewer";
import {
  applyHref,
  bathCount,
  bedCount,
  formatMoney,
  statusLabel,
  isNamedPersonPhone,
  telHref,
  unitLabel,
  utilitiesLabel,
} from "@/lib/format";
import { inventory } from "@/lib/inventory";
import { presentListing } from "@/lib/unit-view";
import type { Listing } from "@/lib/types";

export function UnitDetail({
  listing,
  notice = null,
  assetBase = null,
  showBackLink = true,
}: {
  listing: Listing;
  notice?: ReactNode;
  assetBase?: string | null;
  showBackLink?: boolean;
}) {
  const { meta, note, title, photo, tours, floorPlans } = presentListing(listing);
  const beds = bedCount(listing);
  const baths = bathCount(listing);
  const washer = yesNo(listing.washerDryer, "Yes", "No");
  const nycha = yesNo(listing.nycha, "Yes", "No");
  const hpd = yesNo(listing.hpdTrustFund, "Yes", "No");
  const direct = Boolean(assetBase);

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {showBackLink ? (
        <Link href={meta.href} className="text-sm font-semibold text-accent">
          ← {meta.label}
        </Link>
      ) : null}
      <p className={`${showBackLink ? "mt-5" : ""} text-xs font-semibold uppercase tracking-[0.16em] text-accent`}>
        {meta.label}
        {listing.zip ? ` · ${listing.zip}` : ""}
      </p>
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{listing.address}</h1>
      <p className="mt-2 text-lg text-muted">
        {unitLabel(listing.unit)}
        {listing.unitType ? ` · ${listing.unitType}` : ""}
      </p>
      {notice}

      <section className="mt-6" aria-labelledby="tour-heading">
        <h2 id="tour-heading" className="font-serif text-2xl font-semibold">
          Virtual tour
        </h2>
        {tours.length > 0 ? (
          <div className="mt-3">
            <TourViewer tours={tours} title={title} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Tour not available.</p>
        )}
      </section>

      {floorPlans.length > 0 ? (
        <section className="mt-8" aria-labelledby="plan-heading">
          <h2 id="plan-heading" className="font-serif text-2xl font-semibold">
            {floorPlans.length > 1 ? "Floor plans" : "Floor plan"}
          </h2>
          <div className="mt-4 space-y-6">
            {floorPlans.map((floorPlan, index) => (
              <div key={direct ? `plan-${index}` : floorPlan.src} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
                <figure className="overflow-hidden rounded-lg border border-line bg-white shadow-[var(--shadow)]">
                  {floorPlan.caption ? (
                    <figcaption className="border-b border-line px-4 py-3 text-sm font-semibold">
                      {floorPlan.caption}
                    </figcaption>
                  ) : null}
                  {direct ? (
                    // The optimizer URL is session-gated. This src carries the share token instead.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${assetBase}/plan/${index}`}
                      alt={floorPlan.alt}
                      width={1600}
                      height={1200}
                      className="h-auto w-full"
                    />
                  ) : (
                    <Image
                      src={floorPlan.src}
                      alt={floorPlan.alt}
                      width={1600}
                      height={1200}
                      className="h-auto w-full"
                      sizes="(min-width: 1024px) 900px, 100vw"
                    />
                  )}
                </figure>
                {floorPlan.sqft != null ? (
                  <div className="rounded-lg border border-line bg-panel px-4 py-4 shadow-[var(--shadow)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">SQFT</p>
                    <p className="mt-1 font-serif text-3xl font-semibold tracking-tight">
                      {floorPlan.sqft.toLocaleString("en-US")}
                    </p>
                    <p className="text-sm text-muted">sq ft</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="facts-heading">
        <h2 id="facts-heading" className="font-serif text-2xl font-semibold">
          Details
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {beds != null ? <Fact label="Bedrooms" value={beds === 0 ? "Studio" : String(beds)} /> : null}
          {baths != null ? <Fact label="Bathrooms" value={String(baths)} /> : null}
          {washer ? <Fact label="Washer/dryer" value={washer} /> : null}
          {listing.utilitiesIncluded ? (
            <Fact label="Utilities" value={utilitiesLabel(listing.utilitiesIncluded)} />
          ) : null}
          {nycha ? <Fact label="NYCHA" value={nycha} /> : null}
          {hpd ? <Fact label="HPD / Trust Fund" value={hpd} /> : null}
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
          {listing.unitType ? <Fact label="Unit type" value={listing.unitType} /> : null}
        </dl>
        {note ? (
          <p className="mt-4 whitespace-pre-wrap rounded-lg border border-line bg-panel-2 px-4 py-4 text-sm leading-6">
            {note}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={applyHref(inventory.contact.applyEmail, listing)}
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-white no-underline hover:bg-accent-hover"
          >
            Apply by email
          </a>
          {inventory.contact.phones
            .filter((phone) => !isNamedPersonPhone(phone))
            .map((phone) => (
              <a
                key={phone.number}
                href={telHref(phone.number)}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink no-underline"
              >
                Call {phone.label}
              </a>
            ))}
        </div>
      </section>

      {photo ? (
        <section className="mt-10" aria-labelledby="exterior-heading">
          <h2 id="exterior-heading" className="font-serif text-2xl font-semibold">
            Building exterior
          </h2>
          <figure className="mt-4 max-w-xl overflow-hidden rounded-lg border border-line bg-panel shadow-[var(--shadow)]">
            <div className="relative aspect-[16/10] bg-panel-2">
              {direct ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${assetBase}/exterior`}
                  alt={photo.alt}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <Image src={photo.src} alt={photo.alt} fill className="object-cover" sizes="576px" />
              )}
            </div>
            <figcaption className="border-t border-line px-4 py-2 text-xs text-muted">{photo.credit}</figcaption>
          </figure>
        </section>
      ) : null}
    </article>
  );
}

function yesNo(value: "YES" | "NO" | null, yes: string, no: string): string | null {
  if (value === "YES") return yes;
  if (value === "NO") return no;
  return null;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}
