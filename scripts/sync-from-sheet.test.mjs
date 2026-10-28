import assert from "node:assert/strict";
import test from "node:test";
import { headerKey, parseCsv, readAvailableApartments, sheetColumns } from "./sync-from-sheet.mjs";

/** Available Apartments tab after column A (the duplicate Virtual Tour Links) was deleted. */
const CURRENT_HEADERS = [
  "Property",
  "Unit",
  "Unit Type",
  "Min Rent",
  "Target Rent",
  "Zip",
  "Status",
  "NYCHA",
  "HPD/TrustFund",
  "Utilities Included",
  "Washer/Dryer",
  "VT READY",
  "Virtual Tour Links",
  "Office Notes",
  "Sqft",
];

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function csv(headers, records) {
  const lines = [headers.map(csvCell).join(",")];
  for (const record of records) {
    lines.push(headers.map((header) => csvCell(record[header] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

test("current Available Apartments headers map by name, with the tour link in column M", () => {
  const columns = sheetColumns(CURRENT_HEADERS);
  assert.equal(columns.property, 0);
  assert.equal(columns.unit, 1);
  assert.equal(columns.status, 6);
  assert.equal(columns.tourReady, 11);
  assert.equal(columns.tourUrl, 12);
  assert.equal(columns.officeNotes, 13);
  assert.equal(CURRENT_HEADERS[columns.tourUrl], "Virtual Tour Links");

  const { apartments, omittedReserved } = readAvailableApartments(csv(CURRENT_HEADERS, [
    {
      Property: "1 Coonley Court",
      Unit: "Unit 1",
      "Unit Type": "3B/1B",
      "Min Rent": "$2,800",
      "Target Rent": "$3,550",
      Zip: "10303",
      Status: "Application In Process (not yet approved)",
      NYCHA: "YES",
      "HPD/TrustFund": "YES",
      "Utilities Included": "NO",
      "Washer/Dryer": "NO",
      "VT READY": "DONE",
      "Virtual Tour Links": "https://my.matterport.com/show/?m=vNszHijDsSE leftover",
      "Office Notes": "toilet, foyer needs cleaning",
      Sqft: "869",
    },
    {
      Property: "240 Benziger Ave",
      Unit: "Unit 1",
      "Unit Type": "7B/1.5BA",
      "Min Rent": "4000",
      "Target Rent": "",
      Zip: "10301",
      Status: "RESERVED",
      NYCHA: "YES",
      "HPD/TrustFund": "YES",
      "Utilities Included": "NO",
      "Washer/Dryer": "NO",
      "VT READY": "NO",
      "Virtual Tour Links": "https://example.com/reserved",
      "Office Notes": "",
      Sqft: "1000",
    },
    {
      Property: "14 Fancher Pl",
      Unit: "Unit 1",
      Status: "Turnover-reserved",
      "Virtual Tour Links": "https://example.com/turnover-reserved",
    },
    {
      Property: "GARAGES",
    },
    {
      Property: "9 Baltic Ave",
      Unit: "Unit 3",
      Status: "Available",
      "Virtual Tour Links": "https://example.com/after-garages",
    },
  ]));

  assert.deepEqual(omittedReserved, [
    "240 Benziger Ave Unit 1 (RESERVED)",
    "14 Fancher Pl Unit 1 (Turnover-reserved)",
  ]);
  assert.equal(apartments.length, 1);
  assert.deepEqual(apartments[0], {
    address: "1 Coonley Court",
    unit: "Unit 1",
    unitType: "3B/1B",
    minRent: 2800,
    targetRent: 3550,
    zip: "10303",
    status: "Application In Process",
    nycha: "YES",
    hpdTrustFund: "YES",
    utilitiesIncluded: "NO",
    washerDryer: "NO",
    tourReady: "DONE",
    tourUrl: "https://my.matterport.com/show/?m=vNszHijDsSE",
    officeNotes: "toilet, foyer needs cleaning",
  });
  assert.equal("sqft" in apartments[0], false);
});

test("an empty Virtual Tour Links cell leaves the apartment without a tour", () => {
  const { apartments } = readAvailableApartments(csv(CURRENT_HEADERS, [
    {
      Property: "116 Hillside Ave",
      Unit: "Unit 1",
      "Unit Type": "4Br/2BA",
      "Min Rent": "",
      "Target Rent": "3850",
      Zip: "",
      Status: "Available",
      NYCHA: "YES",
      "HPD/TrustFund": "YES",
      "Utilities Included": "NO",
      "Washer/Dryer": "YES",
      "VT READY": "NO",
      "Virtual Tour Links": "",
      "Office Notes": "",
      Sqft: "",
    },
  ]));
  assert.equal(apartments.length, 1);
  assert.equal(apartments[0].status, "Available");
  assert.equal(apartments[0].tourUrl, null);
});

test("a duplicate Virtual Tour Links column does not steal the tour URL", () => {
  const headers = ["Virtual Tour Links", ...CURRENT_HEADERS];
  const columns = sheetColumns(headers);
  assert.equal(columns.tourUrl, headers.lastIndexOf("Virtual Tour Links"));
  assert.notEqual(columns.tourUrl, 0);

  const text = [
    headers.join(","),
    [
      "https://decoy.example/old-column-a",
      "36 Grove Avenue",
      "Uni t 1",
      "1B/1B",
      "1000",
      "1200",
      "10301",
      "Available",
      "YES",
      "YES",
      "NO",
      "NO",
      "DONE",
      "https://my.matterport.com/show/?m=real",
      "keep",
      "500",
    ].join(","),
  ].join("\n");
  const { apartments } = readAvailableApartments(text);

  assert.equal(apartments.length, 1);
  assert.equal(apartments[0].unit, "Unit 1");
  assert.equal(apartments[0].tourUrl, "https://my.matterport.com/show/?m=real");
  assert.equal(apartments[0].officeNotes, "keep");
});

test("inserting a column still reads each field by its header", () => {
  const headers = [
    "",
    "Property",
    "Unit",
    "Unit Type",
    "Min Rent",
    "Target Rent",
    "Zip",
    "Broker note",
    "Status",
    "NYCHA",
    "HPD / Trust Fund",
    "Utilities Included",
    "Washer / Dryer",
    "VT READY",
    "Virtual Tour Links",
    "Office Notes",
    "Sqft",
  ];
  const columns = sheetColumns(headers);
  assert.equal(columns.property, 1);
  assert.equal(columns.status, headers.indexOf("Status"));
  assert.notEqual(columns.status, 6);
  assert.equal(headerKey(headers[columns.hpdTrustFund]), "hpd/trust fund");

  const row = Object.fromEntries(headers.filter(Boolean).map((header) => [header, ""]));
  row.Property = "91 Taft Avenue";
  row.Unit = "Unit 2";
  row["Unit Type"] = "3B/1B";
  row["Min Rent"] = "$2,800";
  row["Target Rent"] = "3550";
  row.Zip = "10301";
  row["Broker note"] = "do not read this as the status";
  row.Status = "Available";
  row.NYCHA = "YES";
  row["HPD / Trust Fund"] = "YES";
  row["Utilities Included"] = "NO";
  row["Washer / Dryer"] = "YES";
  row["VT READY"] = "DONE";
  row["Virtual Tour Links"] = "https://my.matterport.com/show/?m=jNY3Kd9hNzE";
  row["Office Notes"] = "foyer screens";
  row.Sqft = "9999";

  const { apartments } = readAvailableApartments(csv(headers, [row]));
  assert.equal(apartments.length, 1);
  assert.equal(apartments[0].address, "91 Taft Avenue");
  assert.equal(apartments[0].status, "Available");
  assert.equal(apartments[0].hpdTrustFund, "YES");
  assert.equal(apartments[0].washerDryer, "YES");
  assert.equal(apartments[0].tourUrl, "https://my.matterport.com/show/?m=jNY3Kd9hNzE");
  assert.equal(apartments[0].officeNotes, "foyer screens");
  assert.equal(apartments[0].minRent, 2800);
});

test("a header row without Status fails closed", () => {
  const headers = CURRENT_HEADERS.filter((header) => header !== "Status");
  assert.throws(
    () => sheetColumns(headers),
    /Missing sheet column "status"/,
  );
  assert.throws(
    () => readAvailableApartments(csv(headers, [{ Property: "1 Test Street", Unit: "Unit 1" }])),
    /Missing sheet column "status"/,
  );
});

test("the parser keeps quoted commas inside a field", () => {
  const rows = parseCsv('Property,Office Notes\n"1 Test, Street","a, b"\n');
  assert.deepEqual(rows[1], ["1 Test, Street", "a, b"]);
});

test("a unit case typo is stored as Unit, and blank rents stay blank", () => {
  const { apartments } = readAvailableApartments(csv(CURRENT_HEADERS, [
    {
      Property: "187 York Ave",
      Unit: "UNit 2",
      "Unit Type": "2BR/1BA",
      "Min Rent": "",
      "Target Rent": "",
      Zip: "10301",
      Status: "Turnover In Progress",
      NYCHA: "YES",
      "HPD/TrustFund": "YES",
      "Utilities Included": "NO",
      "Washer/Dryer": "NO",
      "VT READY": "NO",
      "Virtual Tour Links": "",
      "Office Notes": "",
      Sqft: "",
    },
  ]));
  assert.equal(apartments.length, 1);
  assert.equal(apartments[0].unit, "Unit 2");
  assert.equal(apartments[0].unitType, "2BR/1BA");
  assert.equal(apartments[0].zip, "10301");
  assert.equal(apartments[0].status, "Turnover In Progress");
  assert.equal(apartments[0].minRent, null);
  assert.equal(apartments[0].targetRent, null);
  assert.equal(apartments[0].tourUrl, null);
});
