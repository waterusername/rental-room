import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  compareApartmentsByBedrooms,
  displayedStatus,
  groupBoardListings,
  hasMatterportTour,
  isReservedListing,
  statusBoardSection,
} from "./board.ts";
import { bedCount, statusTone } from "./format.ts";
import { listingSqft } from "./floor-plan.ts";
import { findListing, routableListings } from "./inventory.ts";
import { exteriorFor } from "./street-view.ts";
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
    tours: [{ url: "https://my.matterport.com/show/?m=test", label: null }],
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

test("reserved rows are omitted for every viewer, including turnover-reserved", () => {
  const apartments = [
    listing({ id: "open", status: "Available" }),
    listing({ id: "soon", status: "Turn Over In Progress" }),
    listing({ id: "held", status: "Available" }),
    listing({ id: "turnover-held", status: "Turnover-reserved" }),
    listing({ id: "pending", status: "Application In Process" }),
  ];
  const reserved = [
    listing({ id: "held", status: "Available" }),
    listing({ id: "sheet", status: "RESERVED" }),
    listing({ id: "pending", status: "RESERVED" }),
  ];
  for (const status of ["Turnover-reserved", "Turnover Reserved", "RESERVED / Turnover"]) {
    assert.equal(statusBoardSection(status), "reserved", status);
    assert.equal(displayedStatus(status), "Reserved", status);
  }
  const board = groupBoardListings(apartments, reserved);
  const ids = board.flatMap((group) => group.listings.map((item) => item.id));

  assert.deepEqual(board.map((group) => group.id), ["available", "coming-up"]);
  assert.deepEqual(ids, ["open", "pending", "soon"]);
  assert.equal(board.some((group) => group.id === "reserved"), false);

  const reservedIds = new Set(reserved.map((item) => item.id));
  assert.equal(isReservedListing(apartments[2]!, reservedIds), true);
  assert.equal(isReservedListing(apartments[3]!, reservedIds), true);
  assert.equal(isReservedListing(apartments[0]!, reservedIds), false);
  assert.equal(isReservedListing(apartments[4]!, reservedIds), false);
});

test("a live apartments row that reuses a reserved id is shown once", () => {
  const live = listing({
    id: "apt-shared",
    status: "Turnover In Progress",
    address: "230 Benziger Ave",
    unit: "Unit 2",
    unitType: "3B/1B",
    tours: [],
    minRent: 2800,
    targetRent: 3550,
    notes: null,
  });
  const archived = listing({
    id: "apt-shared",
    status: "RESERVED",
    address: "230 Benziger Ave",
    unit: "Unit 2",
    unitType: "3br/1BA",
    tours: [],
    targetRent: null,
    notes: "company info sent - Helena",
  });
  const onlyReserved = listing({ id: "apt-archive-only", status: "RESERVED", tours: [] });
  const board = groupBoardListings([live], [archived, onlyReserved]);
  const shown = board.flatMap((group) => group.listings);

  assert.deepEqual(shown.map((item) => item.id), ["apt-shared"]);
  assert.equal(shown[0], live);
  assert.equal(board.find((group) => group.id === "coming-up")?.listings[0]?.status, "Turnover In Progress");
  assert.equal(new Set(shown.map((item) => item.id)).size, shown.length);
});

test("broker claims leave the site for every viewer", () => {
  const apartments = [
    listing({ id: "open", status: "Available" }),
    listing({ id: "soon", status: "Turn Over In Progress" }),
    listing({ id: "claimed", status: "Available" }),
  ];
  const claimed = new Set(["claimed"]);
  const board = groupBoardListings(apartments, [], { extraReservedIds: claimed });
  const ids = board.flatMap((group) => group.listings.map((item) => item.id));

  assert.deepEqual(ids, ["open", "soon"]);
  assert.equal(board.some((group) => group.id === "reserved"), false);
  assert.equal(isReservedListing(apartments[2]!, claimed), true);
  assert.equal(displayedStatus(apartments[2]!.status, "reserved"), "Reserved");
});

test("the published snapshot hides reserved units and labels turnover as Coming Up", () => {
  const raw = JSON.parse(
    fs.readFileSync(new URL("../data/rental-listings.json", import.meta.url), "utf8"),
  ) as {
    listings: { apartments: Listing[]; reserved: Listing[] };
  };
  const board = groupBoardListings(raw.listings.apartments, raw.listings.reserved);
  const shownIds = new Set(board.flatMap((group) => group.listings.map((item) => item.id)));
  const available = board.find((group) => group.id === "available");
  const comingUp = board.find((group) => group.id === "coming-up");

  assert.deepEqual(board.map((group) => group.id), ["available", "coming-up"]);
  assert.equal(shownIds.has("apt-240-benziger-ave-unit-1"), false);
  assert.equal(findListing("apt-240-benziger-ave-unit-1"), undefined);
  assert.equal(routableListings().some((item) => item.id === "apt-240-benziger-ave-unit-1"), false);
  // 1 Coonley Court Unit 1 left the Available tab on 2026-10-22 (now on Reserved), so it is not shown.
  assert.equal(findListing("apt-1-coonley-court-unit-1"), undefined);
  assert.equal(shownIds.has("apt-1-coonley-court-unit-1"), false);
  assert.equal(displayedStatus("RESERVED", "reserved"), "Reserved");
  assert.ok(available && available.listings.length > 0);
  assert.ok(comingUp && comingUp.listings.length > 0);
  assert.ok(board.findIndex((group) => group.id === "coming-up") > board.findIndex((group) => group.id === "available"));
  for (const item of available.listings) {
    assert.equal(hasMatterportTour(item), true, item.id);
    assert.equal(statusBoardSection(item.status), "available", item.id);
    assert.equal(shownIds.has(item.id), true);
  }
  const noTourIds = [
    "apt-116-hillside-ave-unit-1",
    "apt-14-fancher-pl-unit-1",
    "apt-128-port-richmond-ave-unir-3a",
    "apt-230-benziger-ave-unit-2",
    "apt-15-coonley-court-unit-1",
    "apt-187-york-ave-unit-2",
  ];
  for (const id of noTourIds) {
    assert.equal(comingUp.listings.some((item) => item.id === id), true, id);
    assert.equal(available.listings.some((item) => item.id === id), false, id);
  }
  // 402-404 Jersey Street Unit 2F left the Available tab on 2026-10-30, so it is not shown.
  assert.equal(findListing("apt-402-404-jersey-street-unit-2f"), undefined);
  assert.equal(shownIds.has("apt-402-404-jersey-street-unit-2f"), false);
  assert.equal(available.listings.length, 29);
  assert.equal(comingUp.listings.length, 6);
  const alaska = findListing("apt-124-alaska-st-unit-2-bsmt");
  assert.ok(alaska);
  assert.equal(hasMatterportTour(alaska), true);
  assert.equal(available.listings.some((item) => item.id === alaska.id), true);
  assert.equal(listingSqft(alaska), 597);
  assert.equal(alaska.tours[0]?.url, "https://my.matterport.com/show/?m=qUYikyn8yFK");
  const wright = findListing("apt-99-wright-st-unit-2");
  assert.ok(wright);
  assert.equal(hasMatterportTour(wright), true);
  assert.equal(available.listings.some((item) => item.id === wright.id), true);
  assert.equal(listingSqft(wright), 765);
  assert.equal(wright.tours[0]?.url, "https://my.matterport.com/show/?m=B48unFA5foS");
  const york = findListing("apt-187-york-ave-unit-2");
  assert.ok(york);
  assert.equal(york.address, "187 York Ave");
  assert.equal(york.unit, "Unit 2");
  assert.equal(york.unitType, "2BR/1BA");
  assert.equal(york.zip, "10301");
  assert.equal(york.status, "Turnover In Progress");
  assert.equal(york.minRent, null);
  assert.equal(york.targetRent, null);
  assert.deepEqual(york.tours, []);
  assert.equal(listingSqft(york), null);
  assert.equal(raw.listings.apartments.some((item) => item.id === "apt-230-benziger-ave-1"), false);
  for (const item of comingUp.listings) {
    const turnover = statusBoardSection(item.status) === "coming-up";
    assert.equal(turnover || !hasMatterportTour(item), true, item.id);
    assert.equal(displayedStatus(item.status, "coming-up"), "Coming Up");
  }
  const shownList = board.flatMap((group) => group.listings);
  assert.equal(new Set(shownList.map((item) => item.id)).size, shownList.length);
  const routes = routableListings();
  assert.equal(new Set(routes.map((item) => item.id)).size, routes.length);
  const liveById = new Map(raw.listings.apartments.map((item) => [item.id, item]));
  for (const item of raw.listings.reserved) {
    const live = liveById.get(item.id);
    if (live && live.status !== item.status) {
      assert.equal(shownIds.has(item.id), true, item.id);
      const shown = shownList.find((row) => row.id === item.id);
      assert.equal(shown?.status, live.status);
      assert.notEqual(shown?.status, item.status);
      continue;
    }
    assert.equal(shownIds.has(item.id), false, item.id);
  }
  const benziger = findListing("apt-230-benziger-ave-unit-2");
  assert.ok(benziger);
  assert.equal(routes.filter((item) => item.id === benziger.id).length, 1);
  assert.equal(benziger.address, "230 Benziger Ave");
  assert.equal(benziger.unit, "Unit 2");
  assert.equal(benziger.unitType, "3B/1B");
  assert.equal(benziger.status, "Turnover In Progress");
  assert.equal(benziger.minRent, 2800);
  assert.equal(benziger.targetRent, 3550);
  assert.deepEqual(benziger.tours, []);
  assert.equal(benziger.notes, null);
  assert.equal(listingSqft(benziger), null);
  assert.equal(exteriorFor(benziger)?.src, "/exteriors/apt-230-benziger-ave.jpg");
  assert.equal(comingUp.listings.some((item) => item.id === benziger.id), true);
  for (const item of raw.listings.apartments) {
    if (statusBoardSection(item.status) === "reserved") {
      assert.equal(shownIds.has(item.id), false, item.id);
    }
  }
  for (const group of board) {
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

  const broker = groupBoardListings(apartments, []);
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

test("an apartment with no Matterport tour stays in Coming Up until it has one", () => {
  const bare = listing({ id: "bare", status: "Available", address: "2 Bare Street", tours: [] });
  const credit = listing({
    id: "credit",
    status: "Credit check Requires (CASH)",
    address: "3 Bare Street",
    tours: [],
  });
  const pending = listing({
    id: "pending",
    status: "Application In Process",
    address: "4 Bare Street",
    tours: [{ url: "https://example.com/not-matterport", label: null }],
  });
  const hidden = listing({ id: "hidden", status: "RESERVED", address: "5 Bare Street", tours: [] });
  const toured = listing({ id: "toured", status: "Available", address: "1 Tour Street" });
  const turnover = listing({ id: "turn", status: "Turnover In Progress", address: "9 Tour Street" });
  const board = groupBoardListings([bare, credit, pending, hidden, toured, turnover], []);

  assert.deepEqual(board.map((group) => group.id), ["available", "coming-up"]);
  assert.ok(board.findIndex((group) => group.id === "coming-up") > board.findIndex((group) => group.id === "available"));
  assert.deepEqual(
    board.find((group) => group.id === "available")?.listings.map((item) => item.id),
    ["toured"],
  );
  assert.deepEqual(
    board.find((group) => group.id === "coming-up")?.listings.map((item) => item.id),
    ["bare", "credit", "pending", "turn"],
  );
  assert.equal(hasMatterportTour(bare), false);
  assert.equal(hasMatterportTour(toured), true);

  const promoted = {
    ...bare,
    tours: [{ url: "https://my.matterport.com/show/?m=promoted", label: null }],
  };
  const next = groupBoardListings([promoted, turnover], []);
  assert.deepEqual(
    next.find((group) => group.id === "available")?.listings.map((item) => item.id),
    ["bare"],
  );
  assert.deepEqual(
    next.find((group) => group.id === "coming-up")?.listings.map((item) => item.id),
    ["turn"],
  );
});

test("Application In Process stays broker-visible with its own label", () => {
  for (const status of [
    "Application In Process",
    "Application In Process (not yet approved)",
    "application in process",
  ]) {
    assert.equal(statusBoardSection(status), "available", status);
    assert.equal(displayedStatus(status), "Application In Process", status);
  }
  const apartments = [listing({ id: "pending", status: "Application In Process (not yet approved)" })];
  const broker = groupBoardListings(apartments, []);
  const available = broker.find((group) => group.id === "available");
  assert.ok(available);
  assert.deepEqual(available.listings.map((item) => item.id), ["pending"]);
  assert.equal(statusTone("Application In Process"), "wait");

  // Published snapshot: every Application In Process row is broker-visible in Available.
  const raw = JSON.parse(fs.readFileSync(new URL("../data/rental-listings.json", import.meta.url), "utf8"));
  const live = groupBoardListings(raw.listings.apartments, raw.listings.reserved);
  const liveAvailable = new Set(live.find((group) => group.id === "available")?.listings.map((item) => item.id));
  for (const item of raw.listings.apartments as Listing[]) {
    if (item.status === "Application In Process" && hasMatterportTour(item)) {
      assert.equal(liveAvailable.has(item.id), true, item.id);
    }
  }
});
