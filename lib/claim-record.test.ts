import assert from "node:assert/strict";
import test from "node:test";
import { brokerMayClaim, CLAIM_NOTE_MAX, readClaimNote } from "./claim-record.ts";
import type { Listing } from "./types.ts";

function listing(partial: Partial<Listing> & Pick<Listing, "id" | "status">): Listing {
  return {
    category: "apartment",
    address: "1 Test Street",
    unit: "Unit 1",
    unitType: "1B/1B",
    minRent: null,
    targetRent: null,
    potentialRent: null,
    zip: null,
    nycha: null,
    hpdTrustFund: null,
    utilitiesIncluded: null,
    washerDryer: null,
    tourReady: null,
    tours: [],
    officeNotes: null,
    reservationDate: null,
    daysSinceReservation: null,
    bedrooms: null,
    baths: null,
    prospect: null,
    notes: null,
    ...partial,
  };
}

test("claim notes stay short and optional", () => {
  assert.deepEqual(readClaimNote(null), { ok: true, note: "" });
  assert.deepEqual(readClaimNote("  Signing tonight  "), { ok: true, note: "Signing tonight" });
  assert.equal(readClaimNote("x".repeat(CLAIM_NOTE_MAX + 1)).ok, false);
  assert.equal(readClaimNote(12).ok, false);
});

test("brokers can claim available and coming-up apartments only", () => {
  const open = listing({ id: "open", status: "Available" });
  const soon = listing({ id: "soon", status: "Turn Over In Progress" });
  const held = listing({ id: "held", status: "Available" });
  const sheet = listing({ id: "sheet", status: "RESERVED" });
  const commercial = listing({ id: "store", status: "Available", category: "commercial" });
  const reserved = new Set(["held"]);

  assert.equal(brokerMayClaim(open, reserved), true);
  assert.equal(brokerMayClaim(soon, reserved), true);
  assert.equal(brokerMayClaim(held, reserved), false);
  assert.equal(brokerMayClaim(sheet, new Set()), false);
  assert.equal(brokerMayClaim(commercial, new Set()), false);
});
