import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-panel">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <p className="font-serif text-2xl font-semibold tracking-tight text-ink">Grinberg</p>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Rental Room</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            This link opens a single unit. It does not open the vacancy boards or any other listing.
          </p>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
