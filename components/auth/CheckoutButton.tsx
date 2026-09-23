"use client";

import { useActionState } from "react";
import { startMyCheckout } from "@/lib/auth/actions";
import type { ActionState } from "@/lib/auth/types";

export function CheckoutButton() {
  const [state, action, pending] = useActionState<ActionState, FormData>(startMyCheckout, null);
  return (
    <form action={action} className="mt-4 space-y-3">
      {state?.error ? (
        <p role="alert" className="rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Opening Stripe…" : "Subscribe with Stripe"}
      </button>
    </form>
  );
}
