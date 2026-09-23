import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { MAX_ACTIVE_UNIT_SHARES, ShareLimitError } from "./share-access.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-share-"));
const databaseFile = path.join(dir, "auth.db");
process.env.TURSO_DATABASE_URL = `file:${databaseFile}`;
process.env.DATABASE_URL = `file:${databaseFile}`;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_PRICE_ID;

test("unit share tokens are hashed, scoped, expiring, and revocable", async () => {
  const db = await import("./db.ts");
  const broker = await db.insertUser({
    email: "broker-a@example.com",
    name: "Broker A",
    company: null,
    passwordHash: "hash",
    role: "broker",
    billingStatus: "payment_required",
  });
  const other = await db.insertUser({
    email: "broker-b@example.com",
    name: "Broker B",
    company: null,
    passwordHash: "hash",
    role: "broker",
    billingStatus: "complimentary",
  });
  const admin = await db.insertUser({
    email: "office@example.com",
    name: "Office",
    company: null,
    passwordHash: "hash",
    role: "admin",
    billingStatus: "complimentary",
  });

  const created = await db.createUnitShare({
    unitId: "apt-344-targee-street-unit-1b",
    unitLabel: "344 Targee Street, Unit 1B",
    createdBy: broker.id,
    createdByEmail: broker.email,
  });
  assert.equal(created.token.includes("targee"), false);
  assert.notEqual(created.share.id, created.token);
  assert.equal(created.share.unitId, "apt-344-targee-street-unit-1b");
  assert.equal(created.share.unitLabel, "344 Targee Street, Unit 1B");
  assert.equal(created.share.lastViewedAt, null);
  const lifetime = Date.parse(created.share.expiresAt) - Date.parse(created.share.createdAt);
  assert.equal(lifetime, 14 * 24 * 60 * 60 * 1000);

  const active = await db.readActiveShare(created.token);
  assert.equal(active?.unitId, "apt-344-targee-street-unit-1b");
  assert.equal(active?.createdBy, broker.id);
  assert.equal(await db.readActiveShare(db.hashToken(created.token)), null);
  assert.equal(await db.readActiveShare("a".repeat(43)), null);

  await db.recordShareView(created.share.id);
  const listed = await db.listUnitShareHistory({
    unitId: created.share.unitId,
    actorUserId: broker.id,
    actorIsAdmin: false,
  });
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.viewCount, 1);
  assert.ok(listed[0]?.lastViewedAt);
  assert.equal("token" in listed[0]!, false);
  const hidden = await db.listUnitShareHistory({
    unitId: created.share.unitId,
    actorUserId: other.id,
    actorIsAdmin: false,
  });
  assert.equal(hidden.length, 0);
  const visibleToAdmin = await db.listUnitShareHistory({
    unitId: created.share.unitId,
    actorUserId: admin.id,
    actorIsAdmin: true,
  });
  assert.equal(visibleToAdmin.length, 1);

  assert.equal(
    await db.revokeUnitShare({ id: created.share.id, actorUserId: other.id, actorIsAdmin: false }),
    false,
  );
  assert.ok(await db.readActiveShare(created.token));

  await db.setUserActive(broker.id, false);
  assert.equal(await db.readActiveShare(created.token), null);
  await db.setUserActive(broker.id, true);
  assert.ok(await db.readActiveShare(created.token));

  process.env.STRIPE_SECRET_KEY = "sk_test_share";
  process.env.STRIPE_PRICE_ID = "price_share";
  assert.equal(await db.readActiveShare(created.token), null);
  await db.updateBrokerProfile({
    id: broker.id,
    email: broker.email,
    name: broker.name,
    company: null,
    billingStatus: "active_paid",
  });
  assert.ok(await db.readActiveShare(created.token));

  const expired = await db.createUnitShare({
    unitId: "apt-344-targee-street-unit-1b",
    createdBy: broker.id,
    createdByEmail: broker.email,
    ttlMs: -1000,
  });
  assert.equal(await db.readActiveShare(expired.token), null);

  assert.equal(
    await db.revokeUnitShare({ id: created.share.id, actorUserId: broker.id, actorIsAdmin: false }),
    true,
  );
  assert.equal(await db.readActiveShare(created.token), null);

  const otherShare = await db.createUnitShare({
    unitId: "apt-36-grove-avenue-unit-1",
    createdBy: other.id,
    createdByEmail: other.email,
  });
  assert.equal(
    await db.revokeUnitShare({ id: otherShare.share.id, actorUserId: admin.id, actorIsAdmin: true }),
    true,
  );
  assert.equal(await db.readActiveShare(otherShare.token), null);

  const adminShare = await db.createUnitShare({
    unitId: "apt-344-targee-street-unit-1b",
    createdBy: admin.id,
    createdByEmail: admin.email,
  });
  await db.updateBrokerProfile({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    company: null,
    billingStatus: "payment_required",
  });
  assert.equal((await db.readActiveShare(adminShare.token))?.unitId, "apt-344-targee-street-unit-1b");

  const limitUnit = "unit-limit";
  const tokens: string[] = [];
  for (let i = 0; i < MAX_ACTIVE_UNIT_SHARES; i += 1) {
    const share = await db.createUnitShare({
      unitId: limitUnit,
      createdBy: broker.id,
      createdByEmail: broker.email,
    });
    tokens.push(share.share.id);
  }
  await assert.rejects(
    () =>
      db.createUnitShare({
        unitId: limitUnit,
        createdBy: broker.id,
        createdByEmail: broker.email,
      }),
    ShareLimitError,
  );
  assert.equal(await db.revokeUnitShare({ id: tokens[0]!, actorUserId: broker.id, actorIsAdmin: false }), true);
  const replacement = await db.createUnitShare({
    unitId: limitUnit,
    createdBy: broker.id,
    createdByEmail: broker.email,
  });
  assert.equal((await db.readActiveShare(replacement.token))?.unitId, limitUnit);

  const brokerAudit = await db.listSharesByUser(broker.id);
  assert.ok(brokerAudit.rows.length > 0);
  assert.equal(brokerAudit.rows.every((row) => row.createdBy === broker.id && row.createdByEmail === broker.email), true);
  assert.equal(brokerAudit.rows.some((row) => row.unitId === "apt-36-grove-avenue-unit-1"), false);
  assert.equal(brokerAudit.rows.some((row) => row.id === created.share.id && row.revokedAt), true);
  const otherAudit = await db.listSharesByUser(other.id);
  assert.equal(otherAudit.rows.some((row) => row.id === otherShare.share.id && row.revokedAt), true);
  const counts = await db.shareCountsByUser();
  assert.ok((counts.get(broker.id)?.units ?? 0) >= 2);
  assert.equal(counts.get(broker.id)?.links, brokerAudit.total);
});

test.after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});
