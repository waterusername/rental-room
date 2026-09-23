import { inventory } from "@/lib/inventory";
import { isNamedPersonPhone, telHref } from "@/lib/format";

export function SiteFooter() {
  const { contact } = inventory;
  return (
    <footer className="mt-auto border-t border-line bg-panel">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <p className="max-w-xl text-sm leading-6 text-muted">Equal Housing Opportunity.</p>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Apply</h2>
          <a className="mt-2 inline-block font-semibold text-accent" href={`mailto:${contact.applyEmail}`}>
            {contact.applyEmail}
          </a>
          <ul className="mt-3 space-y-1 text-sm">
            {contact.phones.map((phone) => (
              <li key={phone.number}>
                {isNamedPersonPhone(phone) ? (
                  <span>
                    {phone.label}: {phone.number}
                  </span>
                ) : (
                  <a className="text-ink" href={telHref(phone.number)}>
                    {phone.label}: {phone.number}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
