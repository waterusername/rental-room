import type { Metadata } from "next";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { requireUser } from "@/lib/auth/guards";
import { safeNextPath } from "@/lib/auth/http";

export const metadata: Metadata = {
  title: "Change password",
  robots: { index: false, follow: false },
};

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await requireUser();
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);

  return (
    <>
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Change password</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        {session.mustResetPassword
          ? "Choose a new password before opening the vacancy boards. Use the temporary password you were given as the current password."
          : "Use at least 10 characters. Other sessions on this account are signed out."}
      </p>
      <PasswordForm nextPath={nextPath} />
    </>
  );
}
