import type { Listing } from "./types";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatMoney(value: number | null): string {
  if (value == null) return "Not listed";
  return money.format(value);
}

export function comparableRent(listing: Listing): number | null {
  return listing.targetRent ?? listing.minRent ?? listing.potentialRent;
}

export function rentSummary(listing: Listing): string {
  const { minRent, targetRent, potentialRent } = listing;
  if (minRent != null && targetRent != null && minRent !== targetRent) {
    return `${formatMoney(minRent)} min · ${formatMoney(targetRent)} target`;
  }
  if (targetRent != null) return `${formatMoney(targetRent)} target`;
  if (minRent != null) return formatMoney(minRent);
  if (potentialRent != null) return `${formatMoney(potentialRent)} potential`;
  return "Rent not listed";
}

export function unitLabel(unit: string): string {
  const trimmed = unit.trim();
  if (!trimmed) return "Unit not listed";
  if (/^(unit|#)/i.test(trimmed)) return trimmed;
  return `Unit ${trimmed}`;
}

export function parseBeds(unitType: string): number | null {
  const match = unitType.trim().match(/^(\d+(?:\.\d+)?)\s*(?:br|b)\b/i);
  if (!match) return null;
  return Number(match[1]);
}

/** Second half of strings like "2B/1B", "3BR/1BA", "4B/1.5B", "1 bedroom / 1 bath". */
export function parseBaths(unitType: string): number | null {
  const match = unitType.trim().match(
    /^\d+(?:\.\d+)?\s*b(?:ed(?:room)?s?|r)?\s*\/\s*(\d+(?:\.\d+)?)\s*(?:b(?:ath(?:room)?s?|a)?|baths?)\b/i,
  );
  if (!match) return null;
  return Number(match[1]);
}

export function bedCount(listing: Listing): number | null {
  if (listing.bedrooms != null) return listing.bedrooms;
  return parseBeds(listing.unitType);
}

export function bathCount(listing: Listing): number | null {
  if (listing.baths != null) return listing.baths;
  return parseBaths(listing.unitType);
}

/** Stable option value for a bed or bath count. "1.5" stays "1.5"; 2 stays "2". */
export function countKey(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return String(value);
}

export function bedroomOptionLabel(key: string): string {
  if (key === "0") return "Studio";
  return key === "1" ? "1 bedroom" : `${key} bedrooms`;
}

export function bathroomOptionLabel(key: string): string {
  return key === "1" ? "1 bathroom" : `${key} bathrooms`;
}

export type UnitGroup =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "garage"
  | "storage"
  | "retail"
  | "other";

export function unitGroup(listing: Listing): UnitGroup {
  const blob = `${listing.unitType} ${listing.unit}`.toLowerCase();
  if (blob.includes("garage")) return "garage";
  if (blob.includes("storage") || blob.includes("shed")) return "storage";
  if (blob.includes("retail") || /\bstore\b/.test(blob)) return "retail";
  const beds = bedCount(listing);
  if (beds === 0) return "0";
  if (beds === 1) return "1";
  if (beds === 2) return "2";
  if (beds === 3) return "3";
  if (beds === 4) return "4";
  if (beds != null && beds >= 5) return "5";
  return "other";
}

export const UNIT_GROUP_LABEL: Record<UnitGroup, string> = {
  "0": "Studio / 0 bed",
  "1": "1 bedroom",
  "2": "2 bedrooms",
  "3": "3 bedrooms",
  "4": "4 bedrooms",
  "5": "5+ bedrooms",
  garage: "Garage",
  storage: "Storage",
  retail: "Retail / store",
  other: "Other / not listed",
};

export function statusLabel(status: string): string {
  const trimmed = status.trim();
  return trimmed || "Status not listed";
}

export type Tone = "ok" | "wait" | "alert" | "neutral";

export function statusTone(status: string): Tone {
  const value = status.toLowerCase();
  if (!value.trim()) return "neutral";
  if (value.includes("cancel")) return "alert";
  if (value.includes("available")) return "ok";
  if (
    value.includes("reserved") ||
    value.includes("turnover") ||
    value.includes("cash") ||
    value.includes("credit")
  ) {
    return "wait";
  }
  return "neutral";
}

export function utilitiesLabel(value: string): string {
  const text = value.trim();
  if (/^no$/i.test(text)) return "Utilities not included";
  if (/^yes both$/i.test(text)) return "Utilities included (both)";
  if (/^yes$/i.test(text)) return "Utilities included";
  return `Utilities: ${text}`;
}

export function telHref(number: string): string {
  const digits = number.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return `tel:+1${local}`;
}

const NAMED_PERSON_LABEL = /dimitry|nia|najjar|naja/i;
const NAMED_PERSON_NUMBERS = new Set(["3477430880", "3478995597"]);

/** Dimitry and Nia are listed as text only. Their numbers are not call buttons. */
export function isNamedPersonPhone(phone: { label: string; number: string }): boolean {
  const digits = phone.number.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return NAMED_PERSON_LABEL.test(phone.label) || NAMED_PERSON_NUMBERS.has(local);
}

export function applyHref(email: string, listing: Listing): string {
  const subject = `Rental application — ${listing.address} ${unitLabel(listing.unit)}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
