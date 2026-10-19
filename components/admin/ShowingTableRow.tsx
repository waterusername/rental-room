"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShowingFields } from "@/components/ShowingFields";
import { sendShowing, showingWriteBody, type ShowingFormValues } from "@/components/showing-request";
import { formatShownAt, isoToDatetimeLocal, outcomeLabel, showingBrokerLabel, type ShowingRecord } from "@/lib/showings";

const primaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60";
const quietClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink disabled:opacity-60";

export function ShowingTableRow({
  showing,
  unitLabel,
  unitHref,
}: {
  showing: ShowingRecord;
  unitLabel: string;
  unitHref: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ShowingFormValues>({
    shownAtLocal: isoToDatetimeLocal(showing.shownAt),
    prospectFirstName: showing.prospectFirstName ?? "",
    outcome: showing.outcome ?? "",
    note: showing.note,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = showingWriteBody(values);
    if (!payload.ok) {
      setError(payload.error);
      return;
    }
    setPending(true);
    setError(null);
    const failure = await sendShowing(`/api/showings/${showing.id}`, "PATCH", payload.body);
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Delete this showing?")) return;
    setPending(true);
    setError(null);
    const failure = await sendShowing(`/api/showings/${showing.id}`, "DELETE");
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <tr className="border-b border-line align-top last:border-0">
        <td className="px-3 py-3 whitespace-nowrap">{formatShownAt(showing.shownAt)}</td>
        <td className="px-3 py-3 font-semibold">
          {unitHref ? (
            <Link href={unitHref} className="text-accent no-underline">
              {unitLabel}
            </Link>
          ) : (
            unitLabel
          )}
        </td>
        <td className="px-3 py-3">{showingBrokerLabel(showing)}</td>
        <td className="px-3 py-3">{showing.prospectFirstName ?? "—"}</td>
        <td className="px-3 py-3">{outcomeLabel(showing.outcome)}</td>
        <td className="max-w-xs px-3 py-3 whitespace-pre-wrap">{showing.note || "—"}</td>
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={quietClass} onClick={() => setEditing((open) => !open)}>
              {editing ? "Close" : "Edit"}
            </button>
            <button type="button" className={quietClass} disabled={pending} onClick={() => void remove()}>
              Delete
            </button>
          </div>
        </td>
      </tr>
      {editing ? (
        <tr className="border-b border-line last:border-0">
          <td colSpan={7} className="px-3 py-3">
            <form onSubmit={(event) => void save(event)}>
              <ShowingFields
                idPrefix={`admin-${showing.id}`}
                shownAtLocal={values.shownAtLocal}
                prospectFirstName={values.prospectFirstName}
                outcome={values.outcome}
                note={values.note}
                onShownAtLocal={(shownAtLocal) => setValues((current) => ({ ...current, shownAtLocal }))}
                onProspectFirstName={(prospectFirstName) => setValues((current) => ({ ...current, prospectFirstName }))}
                onOutcome={(outcome) => setValues((current) => ({ ...current, outcome }))}
                onNote={(note) => setValues((current) => ({ ...current, note }))}
              />
              {error ? (
                <p role="alert" className="mt-3 rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={pending} className={`mt-3 ${primaryClass}`}>
                {pending ? "Saving…" : "Save changes"}
              </button>
            </form>
          </td>
        </tr>
      ) : null}
    </>
  );
}
