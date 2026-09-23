import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import type { Role } from "@/lib/auth/types";

export function AccessHeader({
  email,
  role,
  section,
}: {
  email: string;
  role: Role;
  section: string;
}) {
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="no-underline">
          <span className="block font-serif text-2xl font-semibold tracking-tight text-ink">Grinberg</span>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{section}</span>
        </Link>
        <nav aria-label="Account" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
          <Link href="/" className="text-ink no-underline">
            Boards
          </Link>
          {role === "admin" ? (
            <Link href="/admin" className="text-ink no-underline">
              Brokers
            </Link>
          ) : null}
          <Link href="/account" className="text-ink no-underline">
            Account
          </Link>
          <span className="font-normal text-muted">{email}</span>
          <form action={logoutAction}>
            <button type="submit" className="inline-flex min-h-11 items-center font-semibold text-accent">
              Log out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
