"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/auth/actions";
import { PasswordHint } from "@/components/auth/PasswordHint";
import { MAX_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import type { ActionState } from "@/lib/auth/types";

export function PasswordForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(changePasswordAction, null);

  return (
    <form action={action} className="mt-6 space-y-4 rounded-lg border border-line bg-panel p-6 shadow-[var(--shadow)]">
      <input type="hidden" name="next" value={nextPath} />
      {state?.error ? (
        <p role="alert" className="rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
          {state.error}
        </p>
      ) : null}
      <label className="block text-sm font-semibold">
        Current password
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm font-normal"
        />
      </label>
      <label className="block text-sm font-semibold">
        New password
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          maxLength={MAX_PASSWORD_LENGTH}
          required
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm font-normal"
        />
        <PasswordHint />
      </label>
      <label className="block text-sm font-semibold">
        Confirm new password
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          maxLength={MAX_PASSWORD_LENGTH}
          required
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm font-normal"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
