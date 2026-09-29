import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  COMPLETED_RENTAL_SEEDS,
  formatCompletedMoney,
  readCompletedRentalForm,
} from "../completed-rentals.ts";

const dir = mkdtempSync(join(tmpdir(), "rr-completed-"));
process.env.TURSO_DATABASE_URL = `file:${join(dir, "auth.db")}`;
process.env.DATABASE_URL = "";
process.env.TURSO_AUTH_TOKEN = "";

const { deleteCompletedRental, ensureCompletedRentalSeed, insertCompletedRental, listCompletedRentals, updateCompletedRental } =
  await import("./db.ts");

test.after(() => {
  rmSync(dir, { recursive: true, force: true });
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

test("completed rental form keeps property, company, and notes and treats amounts as optional", () => {
  const parsed = readCompletedRentalForm(
    form({
      property: "  87 Simonson Unit 2  ",
      company: "Grinberg Management & Development LLC",
      notes: "09/01/2026 - moved in",
      rentAmount: "$3,200.00",
      feeToCollect: "$1,600.00",
      otherAmount: "$320.00",
    }),
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.property, "87 Simonson Unit 2");
  assert.equal(parsed.value.rentCents, 320_000);
  assert.equal(parsed.value.feeToCollectCents, 160_000);
  assert.equal(parsed.value.otherAmountCents, 32_000);

  const blankMoney = readCompletedRentalForm(
    form({ property: "12 Example Ave", company: "", notes: "", rentAmount: "", feeToCollect: " ", otherAmount: "" }),
  );
  assert.equal(blankMoney.ok, true);
  if (!blankMoney.ok) return;
  assert.equal(blankMoney.value.rentCents, null);
  assert.equal(blankMoney.value.feeToCollectCents, null);
  assert.equal(blankMoney.value.otherAmountCents, null);

  const missing = readCompletedRentalForm(form({ property: "  ", company: "Office" }));
  assert.deepEqual(missing, { ok: false, error: "Enter the property." });

  const badAmount = readCompletedRentalForm(form({ property: "12 Example Ave", otherAmount: "twenty" }));
  assert.equal(badAmount.ok, false);
});

test("completed rentals are seeded once and can be added or edited", async (t) => {
  await t.test("a new database seeds the two finished deals once", async () => {
    const rows = await listCompletedRentals();
    assert.equal(rows.length, COMPLETED_RENTAL_SEEDS.length);
    assert.deepEqual(
      rows.map((row) => ({
        id: row.id,
        property: row.property,
        company: row.company,
        notes: row.notes,
        rentCents: row.rentCents,
        feeToCollectCents: row.feeToCollectCents,
        otherAmountCents: row.otherAmountCents,
      })),
      COMPLETED_RENTAL_SEEDS.map((seed) => ({
        id: seed.id,
        property: seed.property,
        company: seed.company,
        notes: seed.notes,
        rentCents: seed.rentCents,
        feeToCollectCents: seed.feeToCollectCents,
        otherAmountCents: seed.otherAmountCents,
      })),
    );
    assert.equal(formatCompletedMoney(rows[0]?.rentCents ?? null), "$3,200.00");
    assert.equal(formatCompletedMoney(rows[1]?.otherAmountCents ?? null), "$220.00");

    assert.equal(await deleteCompletedRental(COMPLETED_RENTAL_SEEDS[0].id), true);
    await ensureCompletedRentalSeed();
    const after = await listCompletedRentals();
    assert.equal(after.length, 1);
    assert.equal(after[0]?.property, "63 Cassidy Unit 1");
  });

  await t.test("a rental can be added and edited without amounts", async () => {
    const created = await insertCompletedRental({
      property: "10 Bay Street Unit 4",
      company: "Richmond County Management",
      notes: "moved in",
      rentCents: null,
      feeToCollectCents: null,
      otherAmountCents: null,
    });
    assert.equal(created.rentCents, null);

    const saved = await updateCompletedRental(created.id, {
      property: "10 Bay Street Unit 4",
      company: "Grinberg Management & Development LLC",
      notes: "09/12/2026 - moved in",
      rentCents: 180_000,
      feeToCollectCents: null,
      otherAmountCents: null,
    });
    assert.equal(saved, true);

    const rows = await listCompletedRentals();
    const row = rows.find((item) => item.id === created.id);
    assert.equal(row?.company, "Grinberg Management & Development LLC");
    assert.equal(row?.notes, "09/12/2026 - moved in");
    assert.equal(row?.rentCents, 180_000);
    assert.equal(row?.feeToCollectCents, null);
    assert.equal(
      await updateCompletedRental("missing-id", {
        property: created.property,
        company: created.company,
        notes: created.notes,
        rentCents: created.rentCents,
        feeToCollectCents: created.feeToCollectCents,
        otherAmountCents: created.otherAmountCents,
      }),
      false,
    );
  });
});
