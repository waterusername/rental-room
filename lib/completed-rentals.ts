export type CompletedRentalDraft = {
  property: string;
  company: string;
  notes: string;
  rentCents: number | null;
  feeToCollectCents: number | null;
  otherAmountCents: number | null;
};

export type CompletedRental = CompletedRentalDraft & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export const COMPLETED_PROPERTY_MAX = 160;
export const COMPLETED_COMPANY_MAX = 160;
export const COMPLETED_NOTES_MAX = 1000;

/** One-time office rows. Amounts are stored as entered; nothing is derived from them. */
export const COMPLETED_RENTAL_SEEDS: (CompletedRentalDraft & { id: string; createdAt: string })[] = [
  {
    id: "seed-87-simonson-unit-2",
    property: "87 Simonson Unit 2",
    company: "Grinberg Management & Development LLC",
    notes: "09/01/2026 - moved in",
    rentCents: 320_000,
    feeToCollectCents: 160_000,
    otherAmountCents: 32_000,
    createdAt: "2026-09-01T16:00:00.000Z",
  },
  {
    id: "seed-63-cassidy-unit-1",
    property: "63 Cassidy Unit 1",
    company: "Richmond County Management",
    notes: "moving - 09/04/2026",
    rentCents: 220_000,
    feeToCollectCents: 110_000,
    otherAmountCents: 22_000,
    createdAt: "2026-09-04T16:00:00.000Z",
  },
];

const moneyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCompletedMoney(cents: number | null): string {
  if (cents == null) return "—";
  return moneyFormat.format(cents / 100);
}

export function formatCompletedMoneyInput(cents: number | null): string {
  if (cents == null) return "";
  return formatCompletedMoney(cents);
}

type MoneyRead = { ok: true; cents: number | null } | { ok: false; error: string };

function readMoney(raw: string, label: string): MoneyRead {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, cents: null };
  const cleaned = trimmed.replace(/[$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, error: `${label} must be a dollar amount, or left blank.` };
  }
  const [whole, frac = ""] = cleaned.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) {
    return { ok: false, error: `${label} is too large.` };
  }
  return { ok: true, cents };
}

export function readCompletedRentalForm(
  formData: FormData,
): { ok: true; value: CompletedRentalDraft } | { ok: false; error: string } {
  const property = String(formData.get("property") ?? "").trim();
  if (!property) return { ok: false, error: "Enter the property." };
  if (property.length > COMPLETED_PROPERTY_MAX) return { ok: false, error: "Property is too long." };

  const company = String(formData.get("company") ?? "").trim();
  if (company.length > COMPLETED_COMPANY_MAX) return { ok: false, error: "Company is too long." };

  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > COMPLETED_NOTES_MAX) return { ok: false, error: "Notes are too long." };

  const rent = readMoney(String(formData.get("rentAmount") ?? ""), "Rent amount");
  if (!rent.ok) return rent;
  const fee = readMoney(String(formData.get("feeToCollect") ?? ""), "Fee to collect");
  if (!fee.ok) return fee;
  const other = readMoney(String(formData.get("otherAmount") ?? ""), "Other amount");
  if (!other.ok) return other;

  return {
    ok: true,
    value: {
      property,
      company,
      notes,
      rentCents: rent.cents,
      feeToCollectCents: fee.cents,
      otherAmountCents: other.cents,
    },
  };
}
