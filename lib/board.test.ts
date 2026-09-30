import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  compareApartmentsByBedrooms,
  displayedStatus,
  groupBoardListings,
  isReservedListing,
  statusBoardSection,
} from "./board.ts";
import { bedCount } from "./format.ts";
import type { Listing } from "./types.ts";

function listing(partial: Pick<Listing, "id" | "status"> & Partial<Listing>): Listing {
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

test("sheet statuses map onto Available, Coming Up, and Reserved", () => {
  for (const status of ["Available", "available", " Available "]) {
    assert.equal(statusBoardSection(status), "available", status);
    assert.equal(displayedStatus(status), "Available", status);
  }
  for (const status of [
    "Turnover In Progress",
    "Turn Over In Progress",
    "TURN OVER IN PROGRESS",
    "turn-over in progress",
    "Turnover",
  ]) {
    assert.equal(statusBoardSection(status), "coming-up", status);
    assert.equal(displayedStatus(status), "Coming Up", status);
  }
  for (const status of ["RESERVED", "Reserved", "Reserve", " reserve ", "Reservation"]) {
    assert.equal(statusBoardSection(status), "reserved", status);
    assert.equal(displayedStatus(status), "Reserved", status);
  }
  assert.equal(statusBoardSection("Credit check Requires (CASH)"), "available");
  assert.equal(displayedStatus("Credit check Requires (CASH)"), "Credit check Requires (CASH)");
  assert.equal(statusBoardSection("Under Initial Development"), "available");
  assert.equal(displayedStatus("Under Initial Development"), "Under Initial Development");
  assert.equal(statusBoardSection(""), "available");
  assert.equal(displayedStatus(""), "Status not listed");
});

test("reserved rows stay out of the broker board even when status says Available", () => {
  const apartments = [
    listing({ id: "open", status: "Available" }),
    listing({ id: "soon", status: "Turn Over In Progress" }),
    listing({ id: "held", status: "Available" }),
  ];
  const reserved = [listing({ id: "held", status: "Available" }), listing({ id: "sheet", status: "RESERVED" })];
  const broker = groupBoardListings(apartments, reserved, { includeReserved: false });
  const admin = groupBoardListings(apartments, reserved, { includeReserved: true });
  const brokerIds = broker.flatMap((group) => group.listings.map((item) => item.id));

  assert.deepEqual(broker.map((group) => group.id), ["available", "coming-up"]);
  assert.deepEqual(brokerIds, ["open", "soon"]);
  assert.equal(broker.some((group) => group.id === "reserved"), false);
  assert.deepEqual(
    admin.find((group) => group.id === "reserved")?.listings.map((item) => item.id),
    ["held", "sheet"],
  );
  assert.equal(admin.find((group) => group.id === "available")?.listings.map((item) => item.id).includes("held"), false);

  const reservedIds = new Set(reserved.map((item) => item.id));
  assert.equal(isReservedListing(apartments[2], reservedIds), true);
  assert.equal(isReservedListing(apartments[0], reservedIds), false);
});

test("broker claims join the reserved set and leave the broker board", () => {
  const apartments = [
    listing({ id: "open", status: "Available" }),
    listing({ id: "soon", status: "Turn Over In Progress" }),
    listing({ id: "claimed", status: "Available" }),
  ];
  const claimed = new Set(["claimed"]);
  const broker = groupBoardListings(apartments, [], { includeReserved: false, extraReservedIds: claimed });
  const admin = groupBoardListings(apartments, [], { includeReserved: true, extraReservedIds: claimed });
  const brokerIds = broker.flatMap((group) => group.listings.map((item) => item.id));

  assert.deepEqual(brokerIds, ["open", "soon"]);
  assert.equal(broker.some((group) => group.id === "reserved"), false);
  assert.deepEqual(
    admin.find((group) => group.id === "reserved")?.listings.map((item) => item.id),
    ["claimed"],
  );
  assert.equal(isReservedListing(apartments[2], claimed), true);
  assert.equal(displayedStatus(apartments[2].status, "reserved"), "Reserved");
});

test("the published snapshot hides reserved units from brokers and labels turnover as Coming Up", () => {
  const raw = JSON.parse(
    fs.readFileSync(new URL("../data/rental-listings.json", import.meta.url), "utf8"),
  ) as {
    listings: { apartments: Listing[]; reserved: Listing[] };
  };
  const broker = groupBoardListings(raw.listings.apartments, raw.listings.reserved, { includeReserved: false });
  const admin = groupBoardListings(raw.listings.apartments, raw.listings.reserved, { includeReserved: true });
  const brokerIds = new Set(broker.flatMap((group) => group.listings.map((item) => item.id)));
  const reserved = admin.find((group) => group.id === "reserved");
  const available = broker.find((group) => group.id === "available");
  const comingUp = broker.find((group) => group.id === "coming-up");

  assert.ok(reserved);
  assert.equal(brokerIds.has("apt-240-benziger-ave-unit-1"), false);
  assert.equal(
    reserved.listings.some((item) => item.id === "apt-240-benziger-ave-unit-1"),
    true,
  );
  assert.equal(displayedStatus("RESERVED", "reserved"), "Reserved");
  assert.ok(available && available.listings.length > 0);
  assert.ok(comingUp && comingUp.listings.length > 0);
  for (const item of available.listings) {
    assert.equal(statusBoardSection(item.status), "available", item.id);
    assert.equal(brokerIds.has(item.id), true);
  }
  for (const item of comingUp.listings) {
    assert.equal(statusBoardSection(item.status), "coming-up", item.id);
    assert.equal(displayedStatus(item.status, "coming-up"), "Coming Up");
  }
  for (const item of reserved.listings) {
    assert.equal(brokerIds.has(item.id), false, item.id);
  }
  for (const group of [...broker, ...admin]) {
    assertBedroomOrder(group.listings, group.id);
  }
  assert.equal(bedCount(available.listings[0]!), 0);
});

test("apartments sort by bedroom count, studios first, then address and unit", () => {
  const apartments = [
    listing({
      id: "two-late",
      status: "Available",
      address: "20 Oak Street",
      unit: "Unit 2",
      unitType: "2B/1B",
      bedrooms: 2,
    }),
    listing({
      id: "one-b",
      status: "Available",
      address: "10 Oak Street",
      unit: "Unit 10",
      unitType: "1B/1B",
      bedrooms: 1,
    }),
    listing({
      id: "studio-late",
      status: "Available",
      address: "9 Pine Avenue",
      unit: "Unit 2",
      unitType: "0B/1B",
      bedrooms: null,
    }),
    listing({
      id: "studio-early",
      status: "Available",
      address: "2 Pine Avenue",
      unit: "Unit 1",
      unitType: "Studio",
      bedrooms: 0,
    }),
    listing({
      id: "one-a",
      status: "Available",
      address: "10 Oak Street",
      unit: "Unit 2",
      unitType: "1BR/1BA",
      bedrooms: null,
    }),
    listing({
      id: "unknown",
      status: "Available",
      address: "1 Mystery Road",
      unit: "Unit 1",
      unitType: "",
      bedrooms: null,
    }),
    listing({
      id: "three",
      status: "Turn Over In Progress",
      address: "4 Elm Street",
      unit: "Unit 1",
      unitType: "3B/1B",
      bedrooms: 3,
    }),
    listing({
      id: "studio-coming",
      status: "Turnover In Progress",
      address: "1 Elm Street",
      unit: "Unit 1",
      unitType: "0BR/1BA",
      bedrooms: null,
    }),
  ];

  const broker = groupBoardListings(apartments, [], { includeReserved: false });
  assert.deepEqual(
    broker.find((group) => group.id === "available")?.listings.map((item) => item.id),
    ["studio-early", "studio-late", "one-a", "one-b", "two-late", "unknown"],
  );
  assert.deepEqual(
    broker.find((group) => group.id === "coming-up")?.listings.map((item) => item.id),
    ["studio-coming", "three"],
  );
  assert.ok(compareApartmentsByBedrooms(apartments[3]!, apartments[2]!) < 0);
});

function assertBedroomOrder(listings: Listing[], label: string) {
  for (let i = 1; i < listings.length; i++) {
    const previous = listings[i - 1]!;
    const current = listings[i]!;
    assert.ok(
      compareApartmentsByBedrooms(previous, current) <= 0,
      `${label}: ${previous.id} should come before ${current.id}`,
    );
  }
}
