import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const dir = mkdtempSync(join(tmpdir(), "rr-signup-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "auth.db")}`;
process.env.DATABASE_URL = "";
process.env.TURSO_AUTH_TOKEN = "";

const { applyStripeBilling, findUserByEmail, insertUser, markGrinbergOfficeAccounts } = await import("./db.ts");

test.after(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("self sign-up is not promoted to a complimentary administrator", async () => {
  const selfServe = await insertUser({
    email: "daniel@grinbergmanagement.com",
    name: "Daniel",
    company: "Grinberg",
    phone: "(718) 555-0199",
    passwordHash: "hash",
    role: "broker",
    mustResetPassword: false,
    billingStatus: "payment_required",
    termsAcceptedAt: "2026-09-24T15:00:00.000Z",
    selfSignup: true,
  });
  const office = await insertUser({
    email: "fatima@grinbergmanagement.com",
    name: "Fatima",
    company: null,
    passwordHash: "hash",
    role: "broker",
    billingStatus: "payment_required",
    selfSignup: false,
  });

  await markGrinbergOfficeAccounts();
  const selfAfter = await findUserByEmail(selfServe.email);
  const officeAfter = await findUserByEmail(office.email);
  assert.ok(selfAfter);
  assert.ok(officeAfter);
  assert.equal(selfAfter.role, "broker");
  assert.equal(selfAfter.billingStatus, "payment_required");
  assert.equal(selfAfter.selfSignup, true);
  assert.equal(selfAfter.mustResetPassword, false);
  assert.equal(selfAfter.phone, "(718) 555-0199");
  assert.equal(selfAfter.termsAcceptedAt, "2026-09-24T15:00:00.000Z");
  assert.equal(officeAfter.role, "admin");
  assert.equal(officeAfter.billingStatus, "complimentary");

  await applyStripeBilling({
    userId: selfAfter.id,
    customerId: "cus_self",
    subscriptionId: "sub_self",
    billingStatus: "active_paid",
  });
  await applyStripeBilling({
    userId: officeAfter.id,
    customerId: "cus_office",
    subscriptionId: "sub_office",
    billingStatus: "active_paid",
  });
  const selfPaid = await findUserByEmail(selfServe.email);
  const officePaid = await findUserByEmail(office.email);
  assert.equal(selfPaid?.role, "broker");
  assert.equal(selfPaid?.billingStatus, "active_paid");
  assert.equal(officePaid?.role, "admin");
  assert.equal(officePaid?.billingStatus, "complimentary");
});
