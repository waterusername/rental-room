import assert from "node:assert/strict";
import test from "node:test";
import {
  datetimeLocalToIso,
  outcomeLabel,
  parseShowingWrite,
  parseUnitId,
  periodStarts,
  statsForUnits,
  summarizeBrokerShowings,
  unexpectedShowingField,
} from "./showings.ts";

const now = Date.parse("2026-10-19T15:00:00.000Z");

test("showing fields stay minimal and reject contact details", () => {
  const saved = parseShowingWrite(
    {
      shownAt: "2026-10-19T14:30:00.000Z",
      prospectFirstName: " Ana ",
      outcome: "Interested",
      note: "  Liked the light  ",
    },
    now,
  );
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.value.prospectFirstName, "Ana");
  assert.equal(saved.value.outcome, "interested");
  assert.equal(saved.value.note, "Liked the light");
  assert.equal(saved.value.shownAt, "2026-10-19T14:30:00.000Z");

  assert.equal(parseShowingWrite({ shownAt: "2026-10-19T14:30" }, now).ok, false);
  const fullName = parseShowingWrite({ prospectFirstName: "Ana Ruiz" }, now);
  assert.equal(fullName.ok, false);
  if (!fullName.ok) assert.match(fullName.error, /first name only/);

  const email = parseShowingWrite({ prospectFirstName: "ana@example.com" }, now);
  assert.equal(email.ok, false);
  const phoneName = parseShowingWrite({ prospectFirstName: "7185550100" }, now);
  assert.equal(phoneName.ok, false);

  const noteEmail = parseShowingWrite({ note: "Email ana@example.com" }, now);
  assert.equal(noteEmail.ok, false);
  const notePhone = parseShowingWrite({ note: "Call 718-555-0100 tonight" }, now);
  assert.equal(notePhone.ok, false);
  assert.equal(parseShowingWrite({ note: "Meet at 3" }, now).ok, true);

  const future = parseShowingWrite({ shownAt: "2026-10-19T16:00:00.000Z" }, now);
  assert.equal(future.ok, false);
  const omitted = parseShowingWrite({}, now);
  assert.equal(omitted.ok, true);
  if (omitted.ok) assert.equal(omitted.value.shownAt, "2026-10-19T15:00:00.000Z");

  assert.equal(unexpectedShowingField({ phone: "7185550100", shownAt: "2026-10-19T14:30:00.000Z" }, "create"), "That field is not stored.");
  assert.equal(unexpectedShowingField({ lastName: "Ruiz" }, "update"), "That field is not stored.");
  assert.equal(unexpectedShowingField({ userId: "someone-else", unitId: "apt-1" }, "create"), "That field is not stored.");
  assert.equal(unexpectedShowingField({ shownAt: "2026-10-19T14:30:00.000Z", outcome: "applying" }, "update"), null);
  assert.equal(parseUnitId("apt-344-targee-street-unit-1b").ok, true);
  assert.equal(parseUnitId("../secret").ok, false);
  assert.equal(outcomeLabel("not_interested"), "Not interested");
  assert.equal(outcomeLabel(null), "—");
});

test("this week and this month follow America/New_York", () => {
  const mondayMorning = new Date("2026-10-19T14:00:00.000Z");
  const current = periodStarts(mondayMorning);
  assert.equal(current.weekStart.toISOString(), "2026-10-19T04:00:00.000Z");
  assert.equal(current.monthStart.toISOString(), "2026-10-01T04:00:00.000Z");

  const sundayNight = periodStarts(new Date("2026-10-19T03:00:00.000Z"));
  assert.equal(sundayNight.weekStart.toISOString(), "2026-10-12T04:00:00.000Z");

  const january = periodStarts(new Date("2026-01-15T15:00:00.000Z"));
  assert.equal(january.weekStart.toISOString(), "2026-01-12T05:00:00.000Z");
  assert.equal(january.monthStart.toISOString(), "2026-01-01T05:00:00.000Z");

  const summary = summarizeBrokerShowings(
    [
      {
        userId: "ada",
        userEmail: "ada@broker.example",
        brokerName: "Ada",
        shownAt: "2026-10-19T15:00:00.000Z",
      },
      {
        userId: "ada",
        userEmail: "ada@broker.example",
        brokerName: "Ada",
        shownAt: "2026-10-05T15:00:00.000Z",
      },
      {
        userId: "ada",
        userEmail: "ada@broker.example",
        brokerName: "Ada",
        shownAt: "2026-09-15T15:00:00.000Z",
      },
      {
        userId: "bo",
        userEmail: "bo@broker.example",
        brokerName: null,
        shownAt: "2026-10-18T20:00:00.000Z",
      },
    ],
    [
      { id: "ada", email: "ada@broker.example", name: "Ada", role: "broker", active: true },
      { id: "bo", email: "bo@broker.example", name: "Bo", role: "broker", active: true },
      { id: "quiet", email: "quiet@broker.example", name: "Quiet", role: "broker", active: true },
      { id: "office", email: "office@example.com", name: "Office", role: "admin", active: true },
    ],
    mondayMorning,
  );
  const ada = summary.find((row) => row.userId === "ada");
  const bo = summary.find((row) => row.userId === "bo");
  const quiet = summary.find((row) => row.userId === "quiet");
  assert.equal(summary.some((row) => row.userId === "office"), false);
  assert.deepEqual(
    { week: ada?.week, month: ada?.month, total: ada?.total },
    { week: 1, month: 2, total: 3 },
  );
  assert.deepEqual(
    { week: bo?.week, month: bo?.month, total: bo?.total },
    { week: 0, month: 1, total: 1 },
  );
  assert.deepEqual(
    { week: quiet?.week, month: quiet?.month, total: quiet?.total },
    { week: 0, month: 0, total: 0 },
  );
  assert.equal(summary[0]?.userId, "ada");
  assert.equal(summary.at(-1)?.userId, "quiet");

  const stats = statsForUnits(["apt-a", "apt-b"], new Map([["apt-a", { count: 2, lastShownAt: "2026-10-19T15:00:00.000Z" }]]));
  assert.deepEqual(stats["apt-a"], { count: 2, lastShownAt: "2026-10-19T15:00:00.000Z" });
  assert.deepEqual(stats["apt-b"], { count: 0, lastShownAt: null });
});

test("datetime-local converts in the viewer clock and rejects impossible days", () => {
  const iso = datetimeLocalToIso("2026-10-19T11:05");
  assert.ok(iso);
  const back = new Date(iso ?? "");
  assert.equal(back.getFullYear(), 2026);
  assert.equal(back.getMonth(), 9);
  assert.equal(back.getDate(), 19);
  assert.equal(back.getHours(), 11);
  assert.equal(back.getMinutes(), 5);
  assert.equal(datetimeLocalToIso("2026-02-31T10:00"), null);
  assert.equal(datetimeLocalToIso("2026-10-19T11:05:00Z"), null);
});
