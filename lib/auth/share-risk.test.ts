import assert from "node:assert/strict";
import test from "node:test";
import { canBrowseListings, mapStripeSubscriptionStatus } from "./config.ts";
import { clientIp, safeNextPath, summarizeUserAgent } from "./http.ts";
import { evaluateShareRisk, median, networkPrefix, type LoginPoint, type SessionPoint } from "./share-risk.ts";

const NOW = Date.parse("2026-09-23T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function login(at: number, ip: string, sessionId: string): LoginPoint {
  return { at, ip, sessionId };
}

function session(input: Partial<SessionPoint> & Pick<SessionPoint, "id" | "ip" | "createdAt">): SessionPoint {
  return {
    expiresAt: input.createdAt + 14 * 24 * HOUR,
    revokedAt: null,
    lastSeenAt: input.createdAt,
    ...input,
  };
}

test("safe next paths stay on this site", () => {
  assert.equal(safeNextPath(null), "/");
  assert.equal(safeNextPath("/units/abc"), "/units/abc");
  assert.equal(safeNextPath("//evil.example"), "/");
  assert.equal(safeNextPath("https://evil.example"), "/");
  assert.equal(safeNextPath("/login"), "/");
  assert.equal(safeNextPath("/%2F%2Fevil.example"), "/");
});

test("client IP prefers the Vercel header, then x-real-ip, then x-forwarded-for", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.9, 10.0.0.1",
    "x-real-ip": "203.0.113.8",
    "x-vercel-forwarded-for": "203.0.113.7",
  });
  assert.equal(clientIp(headers), "203.0.113.7");
  headers.delete("x-vercel-forwarded-for");
  assert.equal(clientIp(headers), "203.0.113.8");
  headers.delete("x-real-ip");
  assert.equal(clientIp(headers), "203.0.113.9");
});

test("user agent summary names the browser family", () => {
  assert.equal(
    summarizeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"),
    "Chrome · macOS",
  );
});

test("billing gate lets complimentary and paid brokers through only when Stripe is on", () => {
  assert.equal(canBrowseListings({ role: "broker", billingStatus: "payment_required" }, true), false);
  assert.equal(canBrowseListings({ role: "broker", billingStatus: "past_due" }, true), false);
  assert.equal(canBrowseListings({ role: "broker", billingStatus: "canceled" }, true), false);
  assert.equal(canBrowseListings({ role: "broker", billingStatus: "complimentary" }, true), true);
  assert.equal(canBrowseListings({ role: "broker", billingStatus: "active_paid" }, true), true);
  assert.equal(canBrowseListings({ role: "broker", billingStatus: "payment_required" }, false), true);
  assert.equal(canBrowseListings({ role: "admin", billingStatus: "canceled" }, true), true);
});

test("stripe statuses map onto billing states", () => {
  assert.equal(mapStripeSubscriptionStatus("active"), "active_paid");
  assert.equal(mapStripeSubscriptionStatus("trialing"), "active_paid");
  assert.equal(mapStripeSubscriptionStatus("past_due"), "past_due");
  assert.equal(mapStripeSubscriptionStatus("canceled"), "canceled");
  assert.equal(mapStripeSubscriptionStatus("incomplete"), "payment_required");
});

test("one IP does not look like a shared login", () => {
  const flags = evaluateShareRisk({
    now: NOW,
    logins: [login(NOW - HOUR, "203.0.113.4", "a"), login(NOW - 30 * 60 * 1000, "203.0.113.4", "b")],
    sessions: [
      session({ id: "a", ip: "203.0.113.4", createdAt: NOW - HOUR, revokedAt: NOW - 40 * 60 * 1000 }),
      session({ id: "b", ip: "203.0.113.4", createdAt: NOW - 30 * 60 * 1000, lastSeenAt: NOW - 30 * 60 * 1000 }),
    ],
    peerDistinct7: [],
    peerDistinct30: [],
  });
  assert.deepEqual(flags, []);
});

test("a second IP while the first session is active is flagged", () => {
  const flags = evaluateShareRisk({
    now: NOW,
    logins: [login(NOW - 30 * 60 * 1000, "203.0.113.4", "a"), login(NOW - 10 * 60 * 1000, "198.51.100.8", "b")],
    sessions: [
      session({ id: "a", ip: "203.0.113.4", createdAt: NOW - 30 * 60 * 1000, lastSeenAt: NOW - 30 * 60 * 1000 }),
      session({ id: "b", ip: "198.51.100.8", createdAt: NOW - 10 * 60 * 1000, lastSeenAt: NOW - 10 * 60 * 1000 }),
    ],
    peerDistinct7: [],
    peerDistinct30: [],
  });
  assert.ok(flags.some((flag) => flag.code === "rapid_ip_switch"));
  assert.ok(flags.some((flag) => flag.code === "different_networks"));
});

test("a second IP after logout is not a rapid-switch flag", () => {
  const flags = evaluateShareRisk({
    now: NOW,
    logins: [login(NOW - 30 * 60 * 1000, "203.0.113.4", "a"), login(NOW - 10 * 60 * 1000, "198.51.100.8", "b")],
    sessions: [
      session({
        id: "a",
        ip: "203.0.113.4",
        createdAt: NOW - 30 * 60 * 1000,
        revokedAt: NOW - 20 * 60 * 1000,
        lastSeenAt: NOW - 30 * 60 * 1000,
      }),
      session({ id: "b", ip: "198.51.100.8", createdAt: NOW - 10 * 60 * 1000, lastSeenAt: NOW - 10 * 60 * 1000 }),
    ],
    peerDistinct7: [],
    peerDistinct30: [],
  });
  assert.equal(flags.some((flag) => flag.code === "rapid_ip_switch"), false);
  assert.equal(flags.some((flag) => flag.code === "concurrent_sessions"), false);
});

test("the same /16 is not treated as different networks", () => {
  assert.equal(networkPrefix("203.0.113.4"), networkPrefix("203.0.200.9"));
  assert.notEqual(networkPrefix("203.0.113.4"), networkPrefix("198.51.100.8"));
  const flags = evaluateShareRisk({
    now: NOW,
    logins: [login(NOW - 20 * 60 * 1000, "203.0.113.4", "a"), login(NOW - 5 * 60 * 1000, "203.0.200.9", "b")],
    sessions: [
      session({ id: "a", ip: "203.0.113.4", createdAt: NOW - 20 * 60 * 1000, lastSeenAt: NOW - 20 * 60 * 1000 }),
      session({ id: "b", ip: "203.0.200.9", createdAt: NOW - 5 * 60 * 1000, lastSeenAt: NOW - 5 * 60 * 1000 }),
    ],
    peerDistinct7: [],
    peerDistinct30: [],
  });
  assert.ok(flags.some((flag) => flag.code === "rapid_ip_switch"));
  assert.equal(flags.some((flag) => flag.code === "different_networks"), false);
});

test("peer medians raise the distinct-IP threshold", () => {
  assert.equal(median([1, 10, 12]), 10);
  const logins = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"].map((ip, index) =>
    login(NOW - (index + 1) * 24 * HOUR, ip, `s${index}`),
  );
  const quiet = evaluateShareRisk({
    now: NOW,
    logins,
    sessions: [],
    peerDistinct7: [10, 12],
    peerDistinct30: [10, 12],
  });
  assert.equal(quiet.some((flag) => flag.code === "high_ips_7d"), false);
  const loud = evaluateShareRisk({
    now: NOW,
    logins,
    sessions: [],
    peerDistinct7: [],
    peerDistinct30: [],
  });
  assert.ok(loud.some((flag) => flag.code === "high_ips_7d"));
});
