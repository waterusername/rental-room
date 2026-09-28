import { telHref } from "@/lib/format";

const EMERGENCY_PHONE = "718.414.6984";

export function GrinbergNotice({ className = "" }: { className?: string }) {
  return (
    <section
      aria-labelledby="grinberg-notice-heading"
      className={`rounded-lg border border-line bg-panel px-4 py-4 shadow-[var(--shadow)] sm:px-5 ${className}`}
    >
      <h2 id="grinberg-notice-heading" className="font-serif text-2xl font-semibold tracking-tight">
        Managed by Grinberg
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6">
        Grinberg Management renovates and maintains these homes with care. We care about the residents who
        live in them.
      </p>
      <ul className="mt-3 max-w-3xl list-disc space-y-1.5 pl-5 text-sm leading-6">
        <li>
          24/7 emergency repair. Call{" "}
          <a href={telHref(EMERGENCY_PHONE)} className="font-semibold text-accent">
            {EMERGENCY_PHONE}
          </a>
          . The request is dispatched to our maintenance team or an approved vendor.
        </li>
        <li>We respond quickly so small issues don’t become big ones.</li>
        <li>Homes are renovated above the typical affordable-housing standard, with durable finishes.</li>
      </ul>
      <p className="mt-3 text-xs leading-5 text-muted">Equal Housing Opportunity.</p>
      <p className="mt-2 text-sm leading-6">
        <a href="https://www.grinbergmanagement.com/the-difference" className="font-semibold text-accent">
          Learn more at grinbergmanagement.com
        </a>
      </p>
    </section>
  );
}
