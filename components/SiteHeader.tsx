"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import { CATEGORY_NAV } from "@/lib/nav";
import type { Role } from "@/lib/auth/types";

export function SiteHeader({
  viewer,
}: {
  viewer: { email: string; name: string | null; role: Role };
}) {
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="group no-underline">
            <span className="block font-serif text-2xl font-semibold tracking-tight text-ink">
              Grinberg
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Rental Room
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="max-w-sm text-sm text-muted">
              Staten Island vacancy inventory. Source-reported from the office sheet.
            </p>
            {viewer.role === "admin" ? (
              <Link href="/admin" className="text-sm font-semibold text-accent no-underline">
                Access desk
              </Link>
            ) : null}
            <Link href="/account" className="text-sm font-semibold text-ink no-underline">
              {viewer.name || viewer.email}
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">
                Log out
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Listing categories" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-2 pb-1">
            {CATEGORY_NAV.map((item) => {
              const current = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold no-underline ${
                      current
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-panel-2 text-ink hover:border-accent-border hover:bg-accent-soft"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
