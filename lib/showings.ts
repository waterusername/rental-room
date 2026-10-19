import type { Role } from "./auth/types.ts";

export const SHOWING_OUTCOMES = ["interested", "applying", "not_interested"] as const;
export type ShowingOutcome = (typeof SHOWING_OUTCOMES)[number];

export const SHOWING_OUTCOME_LABEL: Record<ShowingOutcome, string> = {
  interested: "Interested",
  applying: "Applying",
  not_interested: "Not interested",
};

export const SHOWING_NOTE_MAX = 280;
export const PROSPECT_FIRST_NAME_MAX = 40;
export const SHOWING_TIME_ZONE = "America/New_York";

const FUTURE_SLACK_MS = 15 * 60 * 1000;
const EARLIEST_SHOWN_AT = Date.parse("2020-01-01T00:00:00.000Z");

const CREATE_FIELDS = new Set(["unitId", "shownAt", "prospectFirstName", "outcome", "note"]);
const UPDATE_FIELDS = new Set(["shownAt", "prospectFirstName", "outcome", "note"]);

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type ShowingRecord = {
  id: string;
  unitId: string;
  userId: string;
  userEmail: string;
  brokerName: string | null;
  shownAt: string;
  prospectFirstName: string | null;
  outcome: ShowingOutcome | null;
  note: string;
  createdAt: string;
};

export type ShowingWrite = {
  shownAt: string;
  prospectFirstName: string | null;
  outcome: ShowingOutcome | null;
  note: string;
};

export type UnitShowingStat = {
  count: number;
  lastShownAt: string | null;
};

export type BrokerShowingSummary = {
  userId: string;
  email: string;
  name: string | null;
  active: boolean;
  week: number;
  month: number;
  total: number;
};

export function outcomeLabel(outcome: ShowingOutcome | null | undefined): string {
  if (!outcome) return "—";
  return SHOWING_OUTCOME_LABEL[outcome];
}

export function showingBrokerLabel(showing: { brokerName: string | null; userEmail: string }): string {
  const name = showing.brokerName?.trim();
  return name || showing.userEmail;
}

export function formatShownAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SHOWING_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(time));
}

export function nowDatetimeLocal(now = new Date()): string {
  return isoToDatetimeLocal(now.toISOString());
}

export function isoToDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** datetime-local is the viewer's wall clock. Convert it before it reaches the server. */
export function datetimeLocalToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }
  return date.toISOString();
}

export function unexpectedShowingField(body: Record<string, unknown>, mode: "create" | "update"): string | null {
  const allowed = mode === "create" ? CREATE_FIELDS : UPDATE_FIELDS;
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) return "That field is not stored.";
  }
  return null;
}

export function parseShowingWrite(
  body: Record<string, unknown>,
  now = Date.now(),
): { ok: true; value: ShowingWrite } | { ok: false; error: string } {
  const shownAt = parseShownAt(body.shownAt, now);
  if (!shownAt.ok) return shownAt;
  const prospectFirstName = parseProspectFirstName(body.prospectFirstName);
  if (!prospectFirstName.ok) return prospectFirstName;
  const outcome = parseOutcome(body.outcome);
  if (!outcome.ok) return outcome;
  const note = parseNote(body.note);
  if (!note.ok) return note;
  return {
    ok: true,
    value: {
      shownAt: shownAt.iso,
      prospectFirstName: prospectFirstName.name,
      outcome: outcome.outcome,
      note: note.note,
    },
  };
}

export function parseUnitId(value: unknown): { ok: true; unitId: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "Choose a unit." };
  const unitId = value.trim();
  if (!/^[A-Za-z0-9-]{1,80}$/.test(unitId)) return { ok: false, error: "Choose a unit." };
  return { ok: true, unitId };
}

export function periodStarts(now: Date, timeZone = SHOWING_TIME_ZONE): { weekStart: Date; monthStart: Date } {
  const parts = zonedParts(now, timeZone);
  const daysSinceMonday = parts.weekday === 0 ? 6 : parts.weekday - 1;
  const week = addCalendarDays(parts.year, parts.month, parts.day, -daysSinceMonday);
  return {
    weekStart: zonedTimeToUtc(week.year, week.month, week.day, 0, 0, timeZone),
    monthStart: zonedTimeToUtc(parts.year, parts.month, 1, 0, 0, timeZone),
  };
}

export function summarizeBrokerShowings(
  showings: Pick<ShowingRecord, "userId" | "userEmail" | "brokerName" | "shownAt">[],
  brokers: { id: string; email: string; name: string | null; role: Role; active: boolean }[],
  now = new Date(),
): BrokerShowingSummary[] {
  const { weekStart, monthStart } = periodStarts(now);
  const weekMs = weekStart.getTime();
  const monthMs = monthStart.getTime();
  const byUser = new Map<string, BrokerShowingSummary>();

  const ensure = (userId: string, email: string, name: string | null, active: boolean) => {
    const current = byUser.get(userId);
    if (current) {
      if (!current.name && name) current.name = name;
      if (email) current.email = email;
      return current;
    }
    const created: BrokerShowingSummary = {
      userId,
      email,
      name,
      active,
      week: 0,
      month: 0,
      total: 0,
    };
    byUser.set(userId, created);
    return created;
  };

  for (const broker of brokers) {
    if (broker.role !== "broker") continue;
    ensure(broker.id, broker.email, broker.name, broker.active);
  }

  for (const showing of showings) {
    const row = ensure(showing.userId, showing.userEmail, showing.brokerName, true);
    row.total += 1;
    const shown = Date.parse(showing.shownAt);
    if (Number.isNaN(shown)) continue;
    if (shown >= monthMs) row.month += 1;
    if (shown >= weekMs) row.week += 1;
  }

  return [...byUser.values()].sort((a, b) => {
    if (b.week !== a.week) return b.week - a.week;
    if (b.month !== a.month) return b.month - a.month;
    if (b.total !== a.total) return b.total - a.total;
    return showingBrokerLabel({ brokerName: a.name, userEmail: a.email }).localeCompare(
      showingBrokerLabel({ brokerName: b.name, userEmail: b.email }),
    );
  });
}

export function statsForUnits(
  unitIds: Iterable<string>,
  counts: Map<string, { count: number; lastShownAt: string }>,
): Record<string, UnitShowingStat> {
  const stats: Record<string, UnitShowingStat> = {};
  for (const id of unitIds) {
    const row = counts.get(id);
    stats[id] = {
      count: row?.count ?? 0,
      lastShownAt: row?.lastShownAt ?? null,
    };
  }
  return stats;
}

function parseShownAt(value: unknown, now: number): { ok: true; iso: string } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, iso: new Date(now).toISOString() };
  if (typeof value !== "string") return { ok: false, error: "Enter a valid date and time." };
  const text = value.trim();
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return { ok: false, error: "Enter a valid date and time." };
  const time = Date.parse(text);
  if (Number.isNaN(time)) return { ok: false, error: "Enter a valid date and time." };
  if (time < EARLIEST_SHOWN_AT) return { ok: false, error: "That showing date is too far in the past." };
  if (time > now + FUTURE_SLACK_MS) return { ok: false, error: "A showing cannot be logged in the future." };
  return { ok: true, iso: new Date(time).toISOString() };
}

function parseProspectFirstName(value: unknown): { ok: true; name: string | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, name: null };
  if (typeof value !== "string") return { ok: false, error: "Use a first name only." };
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return { ok: true, name: null };
  if (text.length > PROSPECT_FIRST_NAME_MAX) {
    return { ok: false, error: "Use a first name of 40 characters or fewer." };
  }
  if (text.includes("@") || /\d/.test(text)) {
    return { ok: false, error: "Use a first name only. Do not include a phone number or email." };
  }
  if (/\s/.test(text)) return { ok: false, error: "Use a first name only." };
  if (!/^[\p{L}][\p{L}'’-]*$/u.test(text)) return { ok: false, error: "Use a first name only." };
  return { ok: true, name: text };
}

function parseOutcome(value: unknown): { ok: true; outcome: ShowingOutcome | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, outcome: null };
  if (typeof value !== "string") return { ok: false, error: "Choose Interested, Applying, or Not interested." };
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return { ok: true, outcome: null };
  if (key === "interested" || key === "applying" || key === "not_interested") {
    return { ok: true, outcome: key };
  }
  return { ok: false, error: "Choose Interested, Applying, or Not interested." };
}

function parseNote(value: unknown): { ok: true; note: string } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, note: "" };
  if (typeof value !== "string") return { ok: false, error: "Keep the note short." };
  const note = value.trim().replace(/\r\n/g, "\n");
  if (note.length > SHOWING_NOTE_MAX) return { ok: false, error: `Keep the note to ${SHOWING_NOTE_MAX} characters.` };
  if (looksLikeContact(note)) {
    return { ok: false, error: "Notes cannot include a phone number or email." };
  }
  return { ok: true, note };
}

function looksLikeContact(value: string): boolean {
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) return true;
  return /\b\d{3}[-.\s)]?\d{3}[-.\s]?\d{4}\b/.test(value);
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(read("hour"));
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: hour === 24 ? 0 : hour,
    minute: Number(read("minute")),
    second: Number(read("second")),
    weekday: WEEKDAY_INDEX[read("weekday")] ?? 0,
  };
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let instant = Date.UTC(year, month - 1, day, hour, minute, 0);
  const desired = instant;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(instant), timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const next = instant - (asUtc - desired);
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant);
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
