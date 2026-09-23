"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/auth/actions";
import type { LoginState } from "@/lib/auth/types";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);

  return (
    <form action={action} className="mt-8 space-y-4 rounded-lg border border-line bg-panel p-6 shadow-[var(--shadow)]">
      <input type="hidden" name="next" value={nextPath} />
      {state?.error ? (
        <p role="alert" className="rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
          {state.error}
        </p>
      ) : null}
      <label className="block text-sm font-semibold">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          spellCheck={false}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm font-normal"
        />
      </label>
      <label className="block text-sm font-semibold">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm font-normal"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
