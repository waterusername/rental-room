"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/lib/auth/actions";
import { PasswordHint } from "@/components/auth/PasswordHint";
import { MAX_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import type { ActionState } from "@/lib/auth/types";

const inputClass = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm font-normal";

export function SignupForm({
  nextPath,
  loginHref,
  stripeOn,
}: {
  nextPath: string;
  loginHref: string;
  stripeOn: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(signupAction, null);

  return (
    <form action={action} className="relative mt-8 space-y-4 rounded-lg border border-line bg-panel p-6 shadow-[var(--shadow)]">
      <input type="hidden" name="next" value={nextPath} />
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Fax
          <input name="fax" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      {state?.error ? (
        <p role="alert" className="rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
          {state.error}{" "}
          {state.emailTaken ? (
            <Link href={loginHref} className="font-semibold text-warn underline">
              Sign in
            </Link>
          ) : null}
        </p>
      ) : null}
      <label className="block text-sm font-semibold">
        Full name
        <input name="name" type="text" autoComplete="name" required maxLength={120} className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          spellCheck={false}
          maxLength={254}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-semibold">
        Phone
        <input name="phone" type="tel" autoComplete="tel" required maxLength={40} className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        Brokerage / company <span className="font-normal text-muted">(optional)</span>
        <input name="company" type="text" autoComplete="organization" maxLength={160} className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          maxLength={MAX_PASSWORD_LENGTH}
          className={inputClass}
        />
        <PasswordHint />
      </label>
      <label className="block text-sm font-semibold">
        Confirm password
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          maxLength={MAX_PASSWORD_LENGTH}
          className={inputClass}
        />
      </label>
      <label className="flex items-start gap-3 text-sm leading-6 font-normal">
        <input name="terms" type="checkbox" value="yes" required className="mt-1" />
        <span>
          I agree to the broker terms. I will not share this site link or advertise the property. Commission is
          one-half month’s rent, paid only on a successful move-in.
        </span>
      </label>
      <p className="text-sm leading-6 text-muted">
        {stripeOn
          ? "This creates an outside-broker account and opens checkout. Access is $100 USD per month. Checkout charges the Stripe Price configured for this site."
          : "This creates an outside-broker account and signs you in. Payment collection is off on this server, so an active account can open the boards."}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create broker account"}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={loginHref} className="font-semibold text-accent">
          Sign in
        </Link>
      </p>
    </form>
  );
}
