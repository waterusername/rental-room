import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney, listedRent, rentSummary, unitLabel } from "./format.ts";
import type { Listing } from "./types.ts";

function rents(partial: Partial<Pick<Listing, "minRent" | "targetRent" | "potentialRent">>): Listing {
  return {
    minRent: null,
    targetRent: null,
    potentialRent: null,
    ...partial,
  } as Listing;
}

test("a blank, zero, or non-numeric rent is Rent TBD", () => {
  assert.equal(rentSummary(rents({})), "Rent TBD");
  assert.equal(formatMoney(null), "Rent TBD");
  assert.equal(formatMoney(Number.NaN), "Rent TBD");
  assert.equal(formatMoney(0), "Rent TBD");
  assert.equal(listedRent(0), null);
  assert.equal(listedRent(Number.NaN), null);
  assert.equal(rentSummary(rents({ minRent: 0, targetRent: 0, potentialRent: Number.NaN })), "Rent TBD");
  assert.equal(rentSummary(rents({ minRent: 2500, targetRent: 2700 })), "$2,500 min · $2,700 target");
  assert.equal(rentSummary(rents({ targetRent: 3850 })), "$3,850 target");
});

test("a unit case typo displays as Unit", () => {
  assert.equal(unitLabel("UNit 2"), "Unit 2");
  assert.equal(unitLabel("Unit 2 - BSMT"), "Unit 2 - BSMT");
  assert.equal(unitLabel("#1"), "#1");
});
