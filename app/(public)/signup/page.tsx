import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";
import { BrokerDisclosure } from "@/components/BrokerDisclosure";
import { SiteFooter } from "@/components/SiteFooter";
import { databaseConfig, paymentsEnforced } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/http";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create broker account",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const databaseReady = Boolean(databaseConfig());
  const carriedNext = nextPath === "/" ? "" : nextPath;
  const loginHref = carriedNext ? `/login?next=${encodeURIComponent(carriedNext)}` : "/login";

  return (
    <>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Broker sign up</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">Create broker account</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This form is for outside brokers. When payments are on, the new account stays closed until the monthly
          subscription is paid. Grinberg staff accounts are created by an administrator. Listings are not shown on this
          page.
        </p>
        <BrokerDisclosure className="mt-4" />
        {!databaseReady ? (
          <p className="mt-4 rounded-md border border-tan-border bg-tan-soft px-3 py-2 text-sm text-tan">
            The access database is not configured for this deployment. Sign-up stays closed until Turso (or
            DATABASE_URL) is set.
          </p>
        ) : null}
        <SignupForm nextPath={carriedNext} loginHref={loginHref} stripeOn={paymentsEnforced()} />
        <p className="mt-4 text-center text-sm text-muted">
          <Link href={loginHref} className="font-semibold text-accent">
            Back to broker sign in
          </Link>
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
