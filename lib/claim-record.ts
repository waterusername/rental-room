import { isReservedListing } from "./board";
import type { Listing } from "./types";

export const CLAIM_NOTE_MAX = 280;

export const CLAIM_NOTIFY_STATUSES = ["pending", "sent", "not_configured", "failed"] as const;
export type ClaimNotifyStatus = (typeof CLAIM_NOTIFY_STATUSES)[number];

/** Durable broker claim. Identity comes from the session, not the form. */
export type UnitClaim = {
  id: string;
  unitId: string;
  unitAddress: string;
  unitLabel: string;
  brokerUserId: string;
  brokerEmail: string;
  brokerName: string | null;
  note: string;
  claimedAt: string;
  notifyStatus: ClaimNotifyStatus;
  notifyDetail: string;
};

export type ClaimSummary = Pick<
  UnitClaim,
  "brokerName" | "brokerEmail" | "note" | "claimedAt" | "notifyStatus" | "notifyDetail"
>;

export function claimSummary(claim: UnitClaim): ClaimSummary {
  return {
    brokerName: claim.brokerName,
    brokerEmail: claim.brokerEmail,
    note: claim.note,
    claimedAt: claim.claimedAt,
    notifyStatus: claim.notifyStatus,
    notifyDetail: claim.notifyDetail,
  };
}

export function asClaimNotifyStatus(value: string): ClaimNotifyStatus {
  return CLAIM_NOTIFY_STATUSES.includes(value as ClaimNotifyStatus) ? (value as ClaimNotifyStatus) : "pending";
}

export function claimBrokerLabel(claim: { brokerName: string | null; brokerEmail: string }): string {
  const name = claim.brokerName?.trim();
  if (name) return `${name} (${claim.brokerEmail})`;
  return claim.brokerEmail;
}

export function claimNotifyLabel(status: ClaimNotifyStatus): string {
  switch (status) {
    case "sent":
      return "Office emailed";
    case "not_configured":
      return "Office email not configured";
    case "failed":
      return "Office email failed";
    case "pending":
      return "Office email pending";
  }
}

export function formatClaimedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function readClaimNote(value: unknown): { ok: true; note: string } | { ok: false; error: string } {
  if (value != null && typeof value !== "string") {
    return { ok: false, error: "The note has to be text." };
  }
  const note = String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (note.length > CLAIM_NOTE_MAX) {
    return { ok: false, error: `Keep the note under ${CLAIM_NOTE_MAX} characters.` };
  }
  return { ok: true, note };
}

/** Available and Coming Up apartments can be claimed. Reserved units cannot. */
export function brokerMayClaim(listing: Listing, reservedIds: ReadonlySet<string>): boolean {
  return listing.category === "apartment" && !isReservedListing(listing, reservedIds);
}

export function claimEmailText(input: {
  brokerName: string | null;
  brokerEmail: string;
  unitAddress: string;
  unitLabel: string;
  unitId: string;
  claimedAt: string;
  note: string;
}): string {
  const name = input.brokerName?.trim();
  const who = name ? `${name} <${input.brokerEmail}>` : input.brokerEmail;
  return [
    "A broker marked a unit Reserved in Grinberg Rental Room.",
    "",
    `Broker: ${who}`,
    `Unit: ${input.unitAddress}, ${input.unitLabel}`,
    `Unit id: ${input.unitId}`,
    `When: ${input.claimedAt}`,
    `Note: ${input.note.trim() || "(none)"}`,
  ].join("\n");
}
