import assert from "node:assert/strict";
import test from "node:test";
import { GRINBERG_ADMIN_EMAILS } from "./auth/config.ts";
import { DANIEL_OFFICE_EMAIL, notifyOfficeOfClaim, officeNotifyRecipients } from "./office-notify.ts";

const notice = {
  brokerName: "Ada Broker",
  brokerEmail: "ada@broker.example",
  unitAddress: "344 Targee Street",
  unitLabel: "Unit 1B",
  unitId: "apt-344-targee-street-unit-1b",
  claimedAt: "2026-09-29T20:15:00.000Z",
  note: "Signing tonight",
};

test("office recipients default to the Grinberg list and always include Daniel", () => {
  const recipients = officeNotifyRecipients({});
  assert.deepEqual(recipients, [...GRINBERG_ADMIN_EMAILS]);
  assert.equal(recipients.includes(DANIEL_OFFICE_EMAIL), true);

  const custom = officeNotifyRecipients({ OFFICE_NOTIFY_EMAILS: " desk@example.com, not-an-email " });
  assert.deepEqual(custom, ["desk@example.com", DANIEL_OFFICE_EMAIL]);
  assert.deepEqual(officeNotifyRecipients({ OFFICE_NOTIFY_EMAILS: "   " }), [...GRINBERG_ADMIN_EMAILS]);
});

test("claim email is skipped until Resend is configured, and the claim text is what would send", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  const skipped = await notifyOfficeOfClaim(notice, {
    env: { RESEND_API_KEY: "", MAIL_FROM: "" },
    fetchImpl,
  });
  assert.equal(called, false);
  assert.equal(skipped.status, "not_configured");
  assert.equal(skipped.recipients.includes(DANIEL_OFFICE_EMAIL), true);
  assert.match(skipped.detail, /RESEND_API_KEY/);
  assert.equal(skipped.detail.includes("secret-key"), false);

  const calls: Array<{ url: string; authorization: string; body: string }> = [];
  const sent = await notifyOfficeOfClaim(notice, {
    env: {
      RESEND_API_KEY: "re_test_secret",
      MAIL_FROM: "Grinberg Rental Room <office@example.com>",
      OFFICE_NOTIFY_EMAILS: "desk@example.com",
    },
    fetchImpl: async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        authorization: headers.get("authorization") ?? "",
        body: String(init?.body ?? ""),
      });
      return new Response("{}", { status: 200 });
    },
  });
  assert.equal(sent.status, "sent");
  assert.equal(sent.detail.includes("re_test_secret"), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://api.resend.com/emails");
  assert.equal(calls[0]?.authorization, "Bearer re_test_secret");
  const payload = JSON.parse(calls[0]?.body ?? "{}") as { from: string; to: string[]; subject: string; text: string };
  assert.equal(payload.from, "Grinberg Rental Room <office@example.com>");
  assert.deepEqual(payload.to, ["desk@example.com", DANIEL_OFFICE_EMAIL]);
  assert.match(payload.subject, /344 Targee Street/);
  assert.match(payload.text, /Ada Broker <ada@broker.example>/);
  assert.match(payload.text, /apt-344-targee-street-unit-1b/);
  assert.match(payload.text, /2026-09-29T20:15:00.000Z/);
  assert.match(payload.text, /Signing tonight/);

  const failed = await notifyOfficeOfClaim(notice, {
    env: { RESEND_API_KEY: "re_test_secret", MAIL_FROM: "office@example.com" },
    fetchImpl: async () => new Response("nope", { status: 502 }),
  });
  assert.equal(failed.status, "failed");
  assert.match(failed.detail, /502/);
  assert.equal(failed.detail.includes("re_test_secret"), false);
});
