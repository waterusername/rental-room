import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { apartmentBoardGroups, isReservedListing } from "../inventory.ts";

const dir = mkdtempSync(join(tmpdir(), "rr-claim-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "auth.db")}`;
process.env.DATABASE_URL = "";
process.env.TURSO_AUTH_TOKEN = "";
delete process.env.RESEND_API_KEY;
delete process.env.MAIL_FROM;
delete process.env.OFFICE_NOTIFY_EMAILS;

const { claimUnitForBroker } = await import("../claim-unit.ts");

describe("broker claims", { concurrency: false }, () => {
test.after(() => {
  rmSync(dir, { recursive: true, force: true });
});

const broker = {
  userId: "broker-1",
  email: "Ada@Broker.Example",
  name: "Ada Broker",
  role: "broker" as const,
};

test("a broker claim reserves the unit, records who claimed it, and emails the office", async () => {
  const calls: string[] = [];
  const env = {
    RESEND_API_KEY: "re_test_secret",
    MAIL_FROM: "office@example.com",
    OFFICE_NOTIFY_EMAILS: "desk@example.com",
  };
  const fetchImpl: typeof fetch = async (_input, init) => {
    calls.push(String(init?.body ?? ""));
    return new Response("{}", { status: 200 });
  };

  const result = await claimUnitForBroker({
    ...broker,
    unitId: "apt-344-targee-street-unit-1b",
    note: "  Client is signing tonight  ",
    env,
    fetchImpl,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.claim.brokerEmail, "ada@broker.example");
  assert.equal(result.claim.brokerName, "Ada Broker");
  assert.equal(result.claim.brokerUserId, "broker-1");
  assert.equal(result.claim.unitAddress, "344 Targee Street");
  assert.equal(result.claim.note, "Client is signing tonight");
  assert.equal(result.claim.notifyStatus, "sent");
  assert.equal(calls.length, 1);
  assert.match(calls[0] ?? "", /daniel@grinbergmanagement.com/);
  assert.match(calls[0] ?? "", /Client is signing tonight/);
  assert.equal((calls[0] ?? "").includes("re_test_secret"), false);

  const brokerBoard = apartmentBoardGroups(false, [result.claim.unitId]);
  const adminBoard = apartmentBoardGroups(true, [result.claim.unitId]);
  const brokerIds = brokerBoard.flatMap((group) => group.listings.map((item) => item.id));
  assert.equal(brokerIds.includes(result.claim.unitId), false);
  assert.equal(brokerBoard.some((group) => group.id === "reserved"), false);
  assert.equal(
    adminBoard.find((group) => group.id === "reserved")?.listings.some((item) => item.id === result.claim.unitId),
    true,
  );
  const listing = adminBoard.flatMap((group) => group.listings).find((item) => item.id === result.claim.unitId);
  assert.ok(listing);
  assert.equal(isReservedListing(listing, [result.claim.unitId]), true);

  const again = await claimUnitForBroker({
    ...broker,
    userId: "broker-2",
    email: "other@broker.example",
    unitId: result.claim.unitId,
    note: "",
    env,
    fetchImpl,
  });
  assert.deepEqual(again, { ok: false, error: "That unit is already reserved." });
  assert.equal(calls.length, 1);
});

test("coming up can be claimed, sheet reserved and admins cannot, and a missing mail setup still saves the claim", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  const coming = apartmentBoardGroups(false).find((group) => group.id === "coming-up")?.listings[0];
  assert.ok(coming);

  const saved = await claimUnitForBroker({
    ...broker,
    userId: "broker-3",
    email: "coming@broker.example",
    name: null,
    unitId: coming.id,
    note: "",
    env: {},
    fetchImpl,
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(called, false);
  assert.equal(saved.claim.notifyStatus, "not_configured");
  assert.equal(saved.claim.brokerName, null);
  assert.match(saved.claim.notifyDetail, /daniel@grinbergmanagement.com/);
  assert.equal(isReservedListing(coming, [saved.claim.unitId]), true);

  const sheet = await claimUnitForBroker({
    ...broker,
    unitId: "apt-240-benziger-ave-unit-1",
    note: "",
    env: {},
    fetchImpl,
  });
  assert.deepEqual(sheet, { ok: false, error: "That unit is already reserved." });

  const admin = await claimUnitForBroker({
    ...broker,
    role: "admin",
    unitId: "apt-36-grove-avenue-unit-1",
    note: "x".repeat(281),
  });
  assert.deepEqual(admin, { ok: false, error: "Only a broker can mark a unit reserved." });

  const longNote = await claimUnitForBroker({
    ...broker,
    unitId: "apt-36-grove-avenue-unit-1",
    note: "x".repeat(281),
    env: {},
    fetchImpl,
  });
  assert.equal(longNote.ok, false);
  if (longNote.ok) return;
  assert.match(longNote.error, /280/);
  assert.equal(called, false);
});
});
