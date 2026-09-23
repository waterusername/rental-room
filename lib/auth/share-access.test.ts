import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  isAnonymousSharePath,
  isShareToken,
  shareCreatorStillAllows,
  shareIsActive,
  shareLifecycle,
  shareLink,
} from "./share-access.ts";

const token = randomBytes(32).toString("base64url");

test("share tokens are 43-character secrets and the public path is only that token", () => {
  assert.equal(token.length, 43);
  assert.equal(isShareToken(token), true);
  assert.equal(isShareToken("apt-344-targee-street-unit-1b"), false);
  assert.equal(isShareToken(`${token}x`), false);
  assert.equal(isAnonymousSharePath(`/s/${token}`), true);
  assert.equal(isAnonymousSharePath(`/s/${token}/`), true);
  assert.equal(isAnonymousSharePath(`/s/${token}/exterior`), true);
  assert.equal(isAnonymousSharePath(`/s/${token}/plan/0`), true);
  assert.equal(isAnonymousSharePath(`/s/${token}/plan/12`), true);

  for (const blocked of [
    "/",
    "/commercial",
    "/garages",
    "/storages",
    "/pipeline",
    "/reserved",
    "/units/apt-344-targee-street-unit-1b",
    "/admin",
    "/admin/brokers/new",
    "/account",
    "/account/billing",
    "/account/password",
    "/login",
    "/api/stripe/webhook",
    "/street-view/344-targee-street.jpg",
    "/layouts/example.png",
    "/_next/image",
    `/s/${token}/plan/100`,
    `/s/${token}/exterior/extra`,
    `/s/${"a".repeat(42)}`,
    "/s/apt-344-targee-street-unit-1b",
  ]) {
    assert.equal(isAnonymousSharePath(blocked), false, blocked);
  }
});

test("share URLs do not carry the unit id", () => {
  const url = shareLink("https://rental-room-tau.vercel.app/", token);
  assert.equal(url, `https://rental-room-tau.vercel.app/s/${token}`);
  assert.equal(url.includes("/units/"), false);
  assert.equal(url.includes("targee"), false);
  assert.throws(() => shareLink("javascript:alert(1)", token));
  assert.throws(() => shareLink("https://rental-room-tau.vercel.app", "apt-344-targee-street-unit-1b"));
});

test("share history marks revoked before expired", () => {
  const now = Date.parse("2026-09-23T12:00:00.000Z");
  assert.equal(shareLifecycle({ expiresAt: "2026-10-07T12:00:00.000Z", revokedAt: null }, now), "active");
  assert.equal(shareLifecycle({ expiresAt: "2026-09-22T12:00:00.000Z", revokedAt: null }, now), "expired");
  assert.equal(
    shareLifecycle({ expiresAt: "2026-09-22T12:00:00.000Z", revokedAt: "2026-09-23T11:00:00.000Z" }, now),
    "revoked",
  );
});

test("expired and revoked shares fail closed", () => {
  const now = Date.parse("2026-09-23T12:00:00.000Z");
  assert.equal(shareIsActive({ expiresAt: "2026-10-07T12:00:00.000Z", revokedAt: null }, now), true);
  assert.equal(shareIsActive({ expiresAt: "2026-09-23T12:00:00.000Z", revokedAt: null }, now), false);
  assert.equal(shareIsActive({ expiresAt: "2026-09-22T12:00:00.000Z", revokedAt: null }, now), false);
  assert.equal(shareIsActive({ expiresAt: "2026-10-07T12:00:00.000Z", revokedAt: "2026-09-23T11:00:00.000Z" }, now), false);
  assert.equal(shareIsActive({ expiresAt: "not-a-date", revokedAt: null }, now), false);
});

test("share links follow the board billing gate", () => {
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPrice = process.env.STRIPE_PRICE_ID;
  const broker = {
    active: true,
    role: "broker" as const,
    billingStatus: "payment_required" as const,
    email: "outside@example.com",
  };
  try {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
    assert.equal(shareCreatorStillAllows(broker), true);

    process.env.STRIPE_SECRET_KEY = "sk_test_share";
    process.env.STRIPE_PRICE_ID = "price_share";
    assert.equal(shareCreatorStillAllows(broker), false);
    assert.equal(shareCreatorStillAllows({ ...broker, billingStatus: "past_due" }), false);
    assert.equal(shareCreatorStillAllows({ ...broker, billingStatus: "canceled" }), false);
    assert.equal(shareCreatorStillAllows({ ...broker, billingStatus: "active_paid" }), true);
    assert.equal(shareCreatorStillAllows({ ...broker, billingStatus: "complimentary" }), true);
    assert.equal(
      shareCreatorStillAllows({ ...broker, role: "admin", email: "office@example.com" }),
      true,
    );
    assert.equal(shareCreatorStillAllows({ ...broker, active: false, role: "admin" }), false);
    assert.equal(shareCreatorStillAllows(null), false);
  } finally {
    restoreEnv("STRIPE_SECRET_KEY", previousSecret);
    restoreEnv("STRIPE_PRICE_ID", previousPrice);
  }
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
