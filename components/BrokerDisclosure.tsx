export function BrokerDisclosure({ className = "" }: { className?: string }) {
  return (
    <aside
      aria-label="Broker terms"
      className={`rounded-lg border border-tan-border bg-tan-soft px-4 py-3 text-sm leading-6 text-ink ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-tan">Broker terms</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Do not share this site link, and do not advertise the property.</li>
        <li>To send a prospect one unit, use the share link on that unit page. It opens only that unit.</li>
        <li>Commission is one-half (½) month’s rent, paid only upon successful move-in.</li>
      </ul>
    </aside>
  );
}
