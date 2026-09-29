"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createCompletedRentalAction,
  deleteCompletedRentalAction,
  updateCompletedRentalAction,
} from "@/lib/auth/completed-actions";
import type { ActionState } from "@/lib/auth/types";

const inputClass = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm font-normal";
const primaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60";
const quietClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink disabled:opacity-60";

function Feedback({ state }: { state: ActionState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <>
      {state.error ? (
        <p role="alert" className="rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-sm text-accent">{state.ok}</p>
      ) : null}
    </>
  );
}

export type CompletedRentalFormValues = {
  id?: string;
  property: string;
  company: string;
  notes: string;
  rentAmount: string;
  feeToCollect: string;
  otherAmount: string;
};

function Fields({ values }: { values: CompletedRentalFormValues }) {
  return (
    <>
      <label className="block text-sm font-semibold sm:col-span-2">
        Property
        <input name="property" type="text" required defaultValue={values.property} className={inputClass} />
      </label>
      <label className="block text-sm font-semibold sm:col-span-2">
        Company <span className="font-normal text-muted">(optional)</span>
        <input name="company" type="text" defaultValue={values.company} className={inputClass} />
      </label>
      <label className="block text-sm font-semibold sm:col-span-2">
        Notes <span className="font-normal text-muted">(optional)</span>
        <textarea name="notes" rows={3} defaultValue={values.notes} className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        Rent amount <span className="font-normal text-muted">(optional)</span>
        <input
          name="rentAmount"
          type="text"
          inputMode="decimal"
          defaultValue={values.rentAmount}
          placeholder="$0.00"
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-semibold">
        Fee to collect <span className="font-normal text-muted">(optional)</span>
        <input
          name="feeToCollect"
          type="text"
          inputMode="decimal"
          defaultValue={values.feeToCollect}
          placeholder="$0.00"
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-semibold">
        Other amount <span className="font-normal text-muted">(optional)</span>
        <input
          name="otherAmount"
          type="text"
          inputMode="decimal"
          defaultValue={values.otherAmount}
          placeholder="$0.00"
          className={inputClass}
        />
      </label>
    </>
  );
}

const emptyValues: CompletedRentalFormValues = {
  property: "",
  company: "",
  notes: "",
  rentAmount: "",
  feeToCollect: "",
  otherAmount: "",
};

export function AddCompletedRentalForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createCompletedRentalAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="mt-8 max-w-3xl space-y-4 rounded-lg border border-line bg-panel p-6 shadow-[var(--shadow)]">
      <h2 className="font-serif text-2xl font-semibold">Add a completed rental</h2>
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Fields values={emptyValues} />
      </div>
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "Adding…" : "Add rental"}
      </button>
    </form>
  );
}

export function EditCompletedRentalForm({ values }: { values: CompletedRentalFormValues & { id: string } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateCompletedRentalAction, null);

  return (
    <form action={action} className="mt-6 max-w-3xl space-y-4 rounded-lg border border-line bg-panel p-6 shadow-[var(--shadow)]">
      <input type="hidden" name="id" value={values.id} />
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Fields values={values} />
      </div>
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function DeleteCompletedRentalButton({ id, label = "Remove" }: { id: string; label?: string }) {
  return (
    <form
      action={deleteCompletedRentalAction}
      onSubmit={(event) => {
        if (!window.confirm("Remove this completed rental?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={quietClass}>
        {label}
      </button>
    </form>
  );
}
