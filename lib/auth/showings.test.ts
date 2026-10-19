import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { apartmentBoardGroups } from "../inventory.ts";
import type { ShowingActor } from "./showings-service.ts";
import type { UserRecord } from "./types.ts";

const dir = mkdtempSync(join(tmpdir(), "rr-showings-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "auth.db")}`;
process.env.DATABASE_URL = "";
process.env.TURSO_AUTH_TOKEN = "";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_PRICE_ID;

const shownAt = "2026-10-19T14:00:00.000Z";
const now = Date.parse("2026-10-19T15:00:00.000Z");
const units = apartmentBoardGroups().flatMap((group) => group.listings.map((listing) => listing.id));
const unitId = units[0];
const otherUnitId = units[1];

describe("showing access", { concurrency: false }, () => {
  let service: typeof import("./showings-service.ts");
  let db: typeof import("./db.ts");
  let broker: UserRecord;
  let other: UserRecord;
  let admin: UserRecord;

  test.before(async () => {
    assert.ok(unitId);
    assert.ok(otherUnitId);
    service = await import("./showings-service.ts");
    db = await import("./db.ts");
    broker = await db.insertUser({
      email: "ada@broker.example",
      name: "Ada Broker",
      company: null,
      passwordHash: "hash",
      role: "broker",
      billingStatus: "payment_required",
    });
    other = await db.insertUser({
      email: "bo@broker.example",
      name: "Bo Broker",
      company: null,
      passwordHash: "hash",
      role: "broker",
      billingStatus: "complimentary",
    });
    admin = await db.insertUser({
      email: "office@example.com",
      name: "Office Admin",
      company: null,
      passwordHash: "hash",
      role: "admin",
      billingStatus: "complimentary",
    });
  });

  test.after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("a broker logs a showing as themselves and cannot see or change another broker's row", async () => {
    const created = await service.createShowingForActor(
      asActor(broker),
      {
        unitId,
        shownAt,
        prospectFirstName: "Ana",
        outcome: "applying",
        note: "Asked about the lease",
        phone: "7185550100",
      },
      now,
    );
    assert.equal(created.status, 400);
    assert.equal("showing" in created.body, false);

    const saved = await service.createShowingForActor(
      asActor(broker),
      { unitId, shownAt, prospectFirstName: "Ana", outcome: "applying", note: "Asked about the lease" },
      now,
    );
    assert.equal(saved.status, 201);
    if (!("showing" in saved.body)) return;
    assert.equal(saved.body.showing.userId, broker.id);
    assert.equal(saved.body.showing.userEmail, broker.email);
    assert.equal(saved.body.showing.brokerName, "Ada Broker");
    assert.equal(saved.body.showing.prospectFirstName, "Ana");
    assert.equal(saved.body.showing.outcome, "applying");
    assert.equal("phone" in saved.body.showing, false);

    const theirs = await service.createShowingForActor(
      asActor(other),
      { unitId, shownAt, prospectFirstName: "Luis", outcome: "not_interested", note: "" },
      now,
    );
    assert.equal(theirs.status, 201);
    if (!("showing" in theirs.body)) return;

    const ownList = await service.listShowingsForActor(asActor(broker), { unitId });
    assert.equal(ownList.status, 200);
    if (!("showings" in ownList.body)) return;
    assert.deepEqual(ownList.body.showings.map((row) => row.id), [saved.body.showing.id]);

    const peeked = await service.listShowingsForActor(asActor(broker), { brokerId: other.id });
    assert.equal(peeked.status, 403);

    const hidden = await service.readShowingForActor(asActor(broker), theirs.body.showing.id);
    assert.equal(hidden.status, 404);

    const blocked = await service.updateShowingForActor(
      asActor(broker),
      theirs.body.showing.id,
      { note: "rewritten", prospectFirstName: "Ada" },
      now,
    );
    assert.equal(blocked.status, 404);
    const untouched = await service.readShowingForActor(asActor(other), theirs.body.showing.id);
    if (!("showing" in untouched.body)) return;
    assert.equal(untouched.body.showing.note, "");
    assert.equal(untouched.body.showing.prospectFirstName, "Luis");

    const removed = await service.deleteShowingForActor(asActor(broker), theirs.body.showing.id);
    assert.equal(removed.status, 404);
    assert.equal((await service.readShowingForActor(asActor(admin), theirs.body.showing.id)).status, 200);

    const guest = await service.listShowingsForActor(null, {});
    assert.equal(guest.status, 401);
    const reset = await service.createShowingForActor(asActor(broker, { mustResetPassword: true }), { unitId }, now);
    assert.equal(reset.status, 403);
  });

  test("admins see every showing, edit without taking it over, and the board counts misses", async () => {
    const all = await service.listShowingsForActor(asActor(admin), {});
    assert.equal(all.status, 200);
    if (!("showings" in all.body)) return;
    assert.equal(all.body.showings.length >= 2, true);

    const filtered = await service.listShowingsForActor(asActor(admin), { brokerId: broker.id, unitId });
    assert.equal(filtered.status, 200);
    if (!("showings" in filtered.body)) return;
    assert.equal(filtered.body.showings.every((row) => row.userId === broker.id && row.unitId === unitId), true);

    const target = filtered.body.showings[0];
    assert.ok(target);
    const edited = await service.updateShowingForActor(
      asActor(admin),
      target.id,
      { shownAt, prospectFirstName: "Ann", outcome: "interested", note: "Still looking", userId: admin.id },
      now,
    );
    assert.equal(edited.status, 400);
    const changed = await service.updateShowingForActor(
      asActor(admin),
      target.id,
      { shownAt, prospectFirstName: "Ann", outcome: "interested", note: "Still looking" },
      now,
    );
    assert.equal(changed.status, 200);
    if (!("showing" in changed.body)) return;
    assert.equal(changed.body.showing.userId, broker.id);
    assert.equal(changed.body.showing.userEmail, broker.email);
    assert.equal(changed.body.showing.note, "Still looking");

    const second = await service.createShowingForActor(
      asActor(admin),
      { unitId: otherUnitId, shownAt, prospectFirstName: null, outcome: null, note: "" },
      now,
    );
    assert.equal(second.status, 201);
    if (!("showing" in second.body)) return;
    assert.equal(second.body.showing.userId, admin.id);

    const stats = await service.showingStatsForUnits([unitId, otherUnitId, "apt-not-shown"]);
    assert.equal((stats[unitId]?.count ?? 0) >= 1, true);
    assert.equal(stats[otherUnitId]?.count, 1);
    assert.equal(stats[otherUnitId]?.lastShownAt, shownAt);
    assert.deepEqual(stats["apt-not-shown"], { count: 0, lastShownAt: null });

    assert.equal((await service.deleteShowingForActor(asActor(broker), second.body.showing.id)).status, 404);
    assert.equal((await service.deleteShowingForActor(asActor(admin), second.body.showing.id)).status, 200);
    assert.equal((await service.readShowingForActor(asActor(admin), second.body.showing.id)).status, 404);

    process.env.STRIPE_SECRET_KEY = "sk_test_showings";
    process.env.STRIPE_PRICE_ID = "price_showings";
    const unpaid = await service.createShowingForActor(asActor(broker), { unitId, shownAt }, now);
    assert.equal(unpaid.status, 403);
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;

    const offBoard = await service.createShowingForActor(
      asActor(broker),
      { unitId: "apt-240-benziger-ave-unit-1", shownAt },
      now,
    );
    assert.equal(offBoard.status, 400);

    await db.insertUnitClaim({
      unitId: otherUnitId,
      unitAddress: "Claimed Street",
      unitLabel: "Unit 1",
      brokerUserId: broker.id,
      brokerEmail: broker.email,
      brokerName: broker.name,
      note: "",
    });
    const claimed = await service.createShowingForActor(asActor(admin), { unitId: otherUnitId, shownAt }, now);
    assert.equal(claimed.status, 400);
  });
});

function asActor(user: UserRecord, overrides: Partial<ShowingActor> = {}): ShowingActor {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustResetPassword: false,
    billingStatus: user.billingStatus,
    selfSignup: user.selfSignup,
    ...overrides,
  };
}
