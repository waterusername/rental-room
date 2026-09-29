import { unitLabel } from "./format.ts";
import { findListing, listingReservedIds } from "./inventory.ts";
import { insertUnitClaim, listUnitClaims, UnitAlreadyClaimedError, updateUnitClaimNotify } from "./auth/db.ts";
import {
  brokerMayClaim,
  claimSummary,
  readClaimNote,
  type ClaimSummary,
  type UnitClaim,
} from "./claim-record.ts";
import { notifyOfficeOfClaim } from "./office-notify.ts";
import type { Role } from "./auth/types.ts";

const NOT_ON_BOARD = "That unit is not on the board.";
const ALREADY_RESERVED = "That unit is already reserved.";

export type ClaimResult = { ok: true; claim: UnitClaim } | { ok: false; error: string };

export async function boardClaims(): Promise<{ ids: Set<string>; byUnit: Record<string, ClaimSummary> }> {
  const claims = await listUnitClaims();
  const ids = new Set<string>();
  const byUnit: Record<string, ClaimSummary> = {};
  for (const claim of claims) {
    ids.add(claim.unitId);
    byUnit[claim.unitId] = claimSummary(claim);
  }
  return { ids, byUnit };
}

export async function claimedUnitIds(): Promise<Set<string>> {
  const claims = await listUnitClaims();
  return new Set(claims.map((claim) => claim.unitId));
}

export async function claimUnitForBroker(input: {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  unitId: string;
  note: unknown;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): Promise<ClaimResult> {
  if (input.role !== "broker") {
    return { ok: false, error: "Only a broker can mark a unit reserved." };
  }

  const parsedNote = readClaimNote(input.note);
  if (!parsedNote.ok) return { ok: false, error: parsedNote.error };

  const listing = findListing(input.unitId.trim());
  if (!listing || listing.category !== "apartment") return { ok: false, error: NOT_ON_BOARD };

  const reservedIds = listingReservedIds(await claimedUnitIds());
  if (!brokerMayClaim(listing, reservedIds)) return { ok: false, error: ALREADY_RESERVED };

  let claim: UnitClaim;
  try {
    claim = await insertUnitClaim({
      unitId: listing.id,
      unitAddress: listing.address,
      unitLabel: unitLabel(listing.unit),
      brokerUserId: input.userId,
      brokerEmail: input.email,
      brokerName: input.name,
      note: parsedNote.note,
    });
  } catch (error) {
    if (error instanceof UnitAlreadyClaimedError) return { ok: false, error: ALREADY_RESERVED };
    console.error("Could not store unit claim", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: "Could not mark this unit reserved." };
  }

  const notice = await notifyOfficeOfClaim(
    {
      brokerName: claim.brokerName,
      brokerEmail: claim.brokerEmail,
      unitAddress: claim.unitAddress,
      unitLabel: claim.unitLabel,
      unitId: claim.unitId,
      claimedAt: claim.claimedAt,
      note: claim.note,
    },
    { env: input.env, fetchImpl: input.fetchImpl },
  );
  try {
    await updateUnitClaimNotify(claim.id, notice.status, notice.detail);
    claim = { ...claim, notifyStatus: notice.status, notifyDetail: notice.detail };
  } catch (error) {
    console.error("Could not store office email status", error instanceof Error ? error.message : "unknown");
  }

  return { ok: true, claim };
}
