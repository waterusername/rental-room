"use client";

import { useActionState, type FormEvent } from "react";
import { claimUnitAction } from "@/lib/auth/claim-actions";
import { CLAIM_NOTE_MAX } from "@/lib/claim-record";
import type { ActionState } from "@/lib/auth/types";

const fieldClass = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm";

export function ClaimUnitForm({
  unitId,
  unitTitle,
  variant,
}: {
  unitId: string;
  unitTitle: string;
  variant: "card" | "page";
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(claimUnitAction, null);

  function confirmClaim(event: FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        `Mark ${unitTitle} Reserved? It leaves your board, and you will not be able to open or share it.`,
      )
    ) {
      event.preventDefault();
    }
  }

  if (variant === "card") {
    return (
      <form action={action} onSubmit={confirmClaim} className="border-t border-line px-4 py-3">
        <input type="hidden" name="unitId" value={unitId} />
        {state?.error ? (
          <p role="alert" className="mb-2 text-sm text-warn">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink hover:border-accent-border hover:bg-accent-soft disabled:opacity-60"
        >
          {pending ? "Marking reserved…" : "Mark reserved"}
        </button>
      </form>
    );
  }

  return (
    <aside className="mt-6 rounded-lg border border-tan-border bg-tan-soft px-4 py-4" aria-label="Mark reserved">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-tan">Mark reserved</h2>
      <p className="mt-2 text-sm leading-6 text-ink">
        You are working this unit. Marking it Reserved tells the office and removes it from the broker boards. You
        will not be able to open or share it after that.
      </p>
      <form action={action} onSubmit={confirmClaim} className="mt-4">
        <input type="hidden" name="unitId" value={unitId} />
        {state?.error ? (
          <p role="alert" className="mb-3 rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
            {state.error}
          </p>
        ) : null}
        <label className="block text-sm font-semibold">
          Note for the office
          <textarea
            name="note"
            maxLength={CLAIM_NOTE_MAX}
            rows={3}
            placeholder="Optional. Who is taking it, or when they sign."
            className={fieldClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Marking reserved…" : "Mark reserved"}
        </button>
      </form>
    </aside>
  );
}
