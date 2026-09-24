import assert from "node:assert/strict";
import test from "node:test";
import { parseSignupForm, selfSignupRecord } from "./signup.ts";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  name: "Ada Broker",
  email: "Ada@Brokerage.Example",
  phone: "(718) 555-0100",
  company: "Ada Realty",
  password: "correct horse",
  confirmPassword: "correct horse",
  terms: "yes",
};

test("self sign-up is always an outside broker who must pay", () => {
  for (const email of [
    "daniel@grinbergmanagement.com",
    "new.person@grinbergmanagement.com",
    "ada@brokerage.example",
  ]) {
    const record = selfSignupRecord({
      email,
      name: "Ada Broker",
      phone: "(718) 555-0100",
      company: null,
      passwordHash: "hash",
      termsAcceptedAt: "2026-09-24T15:00:00.000Z",
    });
    assert.equal(record.role, "broker");
    assert.equal(record.billingStatus, "payment_required");
    assert.equal(record.mustResetPassword, false);
    assert.equal(record.selfSignup, true);
    assert.equal(record.active, true);
    assert.equal(record.createdBy, null);
    assert.equal(record.email, email);
  }
});

test("sign-up form accepts a complete outside broker", () => {
  const parsed = parseSignupForm(form(valid));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.email, "ada@brokerage.example");
  assert.equal(parsed.name, "Ada Broker");
  assert.equal(parsed.phone, "(718) 555-0100");
  assert.equal(parsed.company, "Ada Realty");
  assert.equal(parsed.password, "correct horse");
});

test("sign-up ignores a client-supplied administrator role", () => {
  const data = form(valid);
  data.set("role", "admin");
  data.set("billingStatus", "complimentary");
  const parsed = parseSignupForm(data);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal("role" in parsed, false);
  assert.equal("billingStatus" in parsed, false);
});

test("sign-up requires the broker terms, a matching password, and a phone number", () => {
  const missingTerms = form(valid);
  missingTerms.delete("terms");
  assert.equal(parseSignupForm(missingTerms).ok, false);

  const short = form({ ...valid, password: "short", confirmPassword: "short" });
  const shortResult = parseSignupForm(short);
  assert.equal(shortResult.ok, false);
  if (!shortResult.ok) assert.match(shortResult.error, /10 characters/);

  const mismatch = form({ ...valid, confirmPassword: "correct horse!" });
  const mismatchResult = parseSignupForm(mismatch);
  assert.equal(mismatchResult.ok, false);
  if (!mismatchResult.ok) assert.match(mismatchResult.error, /do not match/);

  const phone = form({ ...valid, phone: "555" });
  assert.equal(parseSignupForm(phone).ok, false);
});

test("honeypot submissions are rejected without a field hint", () => {
  const data = form(valid);
  data.set("fax", "http://spam.example");
  const parsed = parseSignupForm(data);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.honeypot, true);
    assert.equal(parsed.error.includes("fax"), false);
  }
});
