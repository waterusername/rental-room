import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { BrokerDisclosure } from "@/components/BrokerDisclosure";
import { adminEnvWarning, databaseConfig } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/http";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const databaseReady = Boolean(databaseConfig());
  const adminWarning = adminEnvWarning();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Grinberg rental room</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Broker sign in</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Vacancy boards are open to signed-in brokers and administrators. Listings are not shown on this page.
      </p>
      <BrokerDisclosure className="mt-4" />
      {params.error === "setup" || !databaseReady ? (
        <p className="mt-4 rounded-md border border-tan-border bg-tan-soft px-3 py-2 text-sm text-tan">
          The access database is not configured for this deployment. Listings stay closed until Turso (or
          DATABASE_URL) is set. See the README for the first-run steps.
        </p>
      ) : null}
      {params.error === "unavailable" ? (
        <p role="alert" className="mt-4 rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
          The access database could not be reached. Try again in a moment.
        </p>
      ) : null}
      {adminWarning ? (
        <p className="mt-4 rounded-md border border-tan-border bg-tan-soft px-3 py-2 text-sm text-tan">{adminWarning}</p>
      ) : null}
      <LoginForm nextPath={nextPath === "/" ? "" : nextPath} />
      <div className="mt-4 rounded-lg border border-line bg-panel p-6 text-center shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Broker sign up</p>
        <p className="mt-2 text-sm leading-6 text-muted">Outside brokers can create an account and subscribe for access.</p>
        <Link
          href={nextPath === "/" ? "/signup" : `/signup?next=${encodeURIComponent(nextPath)}`}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-accent bg-white px-4 text-sm font-semibold text-accent no-underline hover:bg-accent-soft"
        >
          Create broker account
        </Link>
      </div>
    </div>
  );
}
