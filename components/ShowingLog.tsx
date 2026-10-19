"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShowingFields } from "@/components/ShowingFields";
import { sendShowing, showingWriteBody, type ShowingFormValues } from "@/components/showing-request";
import { formatShownAt, isoToDatetimeLocal, nowDatetimeLocal, outcomeLabel, showingBrokerLabel, type ShowingRecord } from "@/lib/showings";

const primaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60";
const quietClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink disabled:opacity-60";

export function ShowingLog({
  unitId,
  viewerLabel,
  showings,
  showBroker,
  currentUserId,
  canEditEveryRow,
}: {
  unitId: string;
  viewerLabel: string;
  showings: ShowingRecord[];
  showBroker: boolean;
  currentUserId: string;
  canEditEveryRow: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ShowingFormValues>(blankShowing);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<ShowingFormValues>(blankShowing);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createShowing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = showingWriteBody(values);
    if (!payload.ok) {
      setError(payload.error);
      setStatus(null);
      return;
    }
    setPending(true);
    setError(null);
    const failure = await sendShowing("/api/showings", "POST", { unitId, ...payload.body });
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setValues(blankShowing());
    setStatus("Showing logged.");
    router.refresh();
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>, showingId: string) {
    event.preventDefault();
    const payload = showingWriteBody(editValues);
    if (!payload.ok) {
      setError(payload.error);
      setStatus(null);
      return;
    }
    setPending(true);
    setError(null);
    const failure = await sendShowing(`/api/showings/${showingId}`, "PATCH", payload.body);
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setEditingId(null);
    setStatus("Showing updated.");
    router.refresh();
  }

  async function removeShowing(showingId: string) {
    if (!window.confirm("Delete this showing?")) return;
    setPending(true);
    setError(null);
    const failure = await sendShowing(`/api/showings/${showingId}`, "DELETE");
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    if (editingId === showingId) setEditingId(null);
    setStatus("Showing deleted.");
    router.refresh();
  }

  return (
    <aside className="mt-6 rounded-lg border border-line bg-panel px-4 py-4 shadow-[var(--shadow)]" aria-label="Showings">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Showings</h2>
      <p className="mt-2 text-sm leading-6 text-ink">
        Log a visit for this unit. The broker is {viewerLabel}, from your sign-in. A first name is enough. Do not add a
        phone, email, or last name.
      </p>
      <form onSubmit={createShowing} className="mt-4">
        <ShowingFields
          idPrefix={`log-${unitId}`}
          shownAtLocal={values.shownAtLocal}
          prospectFirstName={values.prospectFirstName}
          outcome={values.outcome}
          note={values.note}
          onShownAtLocal={(shownAtLocal) => setValues((current) => ({ ...current, shownAtLocal }))}
          onProspectFirstName={(prospectFirstName) => setValues((current) => ({ ...current, prospectFirstName }))}
          onOutcome={(outcome) => setValues((current) => ({ ...current, outcome }))}
          onNote={(note) => setValues((current) => ({ ...current, note }))}
        />
        <button type="submit" disabled={pending} className={`mt-3 ${primaryClass}`}>
          {pending ? "Saving…" : "Log a showing"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="mt-3 rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-sm text-accent">
          {status}
        </p>
      ) : null}

      <h3 className="mt-6 text-sm font-semibold">
        {showBroker ? "Showings on this unit" : "Your showings on this unit"}
      </h3>
      {showings.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {showBroker ? "No showings logged for this unit yet." : "You have not logged a showing for this unit yet."}
        </p>
      ) : (
        <ul className="mt-2">
          {showings.map((showing) => {
            const canManage = canEditEveryRow || showing.userId === currentUserId;
            const editing = editingId === showing.id;
            return (
              <li key={showing.id} className="border-t border-line py-3">
                <p className="text-sm font-semibold">{formatShownAt(showing.shownAt)}</p>
                <p className="mt-1 text-sm text-muted">
                  {showing.prospectFirstName ?? "No first name"}
                  {" · "}
                  {outcomeLabel(showing.outcome)}
                  {showBroker ? ` · ${showingBrokerLabel(showing)}` : ""}
                </p>
                {showing.note ? <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{showing.note}</p> : null}
                {canManage && !editing ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={quietClass}
                      onClick={() => {
                        setEditingId(showing.id);
                        setEditValues({
                          shownAtLocal: isoToDatetimeLocal(showing.shownAt),
                          prospectFirstName: showing.prospectFirstName ?? "",
                          outcome: showing.outcome ?? "",
                          note: showing.note,
                        });
                        setError(null);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={quietClass}
                      disabled={pending}
                      onClick={() => void removeShowing(showing.id)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
                {canManage && editing ? (
                  <form onSubmit={(event) => void saveEdit(event, showing.id)} className="mt-3">
                    <ShowingFields
                      idPrefix={`edit-${showing.id}`}
                      shownAtLocal={editValues.shownAtLocal}
                      prospectFirstName={editValues.prospectFirstName}
                      outcome={editValues.outcome}
                      note={editValues.note}
                      onShownAtLocal={(shownAtLocal) => setEditValues((current) => ({ ...current, shownAtLocal }))}
                      onProspectFirstName={(prospectFirstName) =>
                        setEditValues((current) => ({ ...current, prospectFirstName }))
                      }
                      onOutcome={(outcome) => setEditValues((current) => ({ ...current, outcome }))}
                      onNote={(note) => setEditValues((current) => ({ ...current, note }))}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="submit" disabled={pending} className={primaryClass}>
                        {pending ? "Saving…" : "Save changes"}
                      </button>
                      <button type="button" className={quietClass} onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function blankShowing(): ShowingFormValues {
  return { shownAtLocal: nowDatetimeLocal(), prospectFirstName: "", outcome: "", note: "" };
}
