import { SHOWING_NOTE_MAX, SHOWING_OUTCOME_LABEL, SHOWING_OUTCOMES } from "@/lib/showings";

const fieldClass = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm font-normal";

export function ShowingFields({
  idPrefix,
  shownAtLocal,
  prospectFirstName,
  outcome,
  note,
  onShownAtLocal,
  onProspectFirstName,
  onOutcome,
  onNote,
}: {
  idPrefix: string;
  shownAtLocal: string;
  prospectFirstName: string;
  outcome: string;
  note: string;
  onShownAtLocal: (value: string) => void;
  onProspectFirstName: (value: string) => void;
  onOutcome: (value: string) => void;
  onNote: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-semibold" htmlFor={`${idPrefix}-when`}>
        Date and time
        <input
          id={`${idPrefix}-when`}
          type="datetime-local"
          required
          value={shownAtLocal}
          onChange={(event) => onShownAtLocal(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm font-semibold" htmlFor={`${idPrefix}-name`}>
        Prospect first name
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={prospectFirstName}
          maxLength={40}
          autoComplete="off"
          placeholder="Optional"
          onChange={(event) => onProspectFirstName(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm font-semibold" htmlFor={`${idPrefix}-outcome`}>
        Outcome
        <select
          id={`${idPrefix}-outcome`}
          value={outcome}
          onChange={(event) => onOutcome(event.target.value)}
          className={fieldClass}
        >
          <option value="">Optional</option>
          {SHOWING_OUTCOMES.map((value) => (
            <option key={value} value={value}>
              {SHOWING_OUTCOME_LABEL[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold sm:col-span-2" htmlFor={`${idPrefix}-note`}>
        Note
        <textarea
          id={`${idPrefix}-note`}
          value={note}
          maxLength={SHOWING_NOTE_MAX}
          rows={3}
          placeholder="Optional. No phone, email, or last name."
          onChange={(event) => onNote(event.target.value)}
          className={fieldClass}
        />
      </label>
    </div>
  );
}
