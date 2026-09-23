"use server";

import { revalidatePath } from "next/cache";
import { getListing } from "@/lib/inventory";
import { unitLabel } from "@/lib/format";
import { appBaseUrl } from "./stripe";
import { createUnitShare, revokeUnitShare } from "./db";
import { requireBrowse } from "./guards";
import {
  MAX_ACTIVE_UNIT_SHARES,
  ShareLimitError,
  parseShareTtlDays,
  shareLink,
  shareTtlLabel,
  shareTtlMs,
} from "./share-access";
import type { ActionState } from "./types";

export async function createUnitShareAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireBrowse();
  const unitId = String(formData.get("unitId") ?? "");
  const listing = getListing(unitId);
  if (!listing) return { error: "That unit is not on the board." };

  let origin: string;
  try {
    origin = await appBaseUrl();
  } catch (error) {
    console.error("Share link origin missing", error instanceof Error ? error.message : "unknown");
    return { error: "Set the public site address before creating a share link." };
  }

  const ttlDays = parseShareTtlDays(formData.get("ttlDays"));
  if (ttlDays == null) return { error: "Choose 1 day, 3 days, 7 days, or 14 days." };

  try {
    const label = `${listing.address}, ${unitLabel(listing.unit)}`;
    const created = await createUnitShare({
      unitId: listing.id,
      unitLabel: label,
      createdBy: session.userId,
      createdByEmail: session.email,
      ttlMs: shareTtlMs(ttlDays),
    });
    const url = shareLink(origin, created.token);
    revalidatePath(`/units/${listing.id}`);
    return {
      ok: `Copy this link now. It will not be shown again. It opens only ${label} and expires in ${shareTtlLabel(ttlDays)} unless you revoke it.`,
      shareUrl: url,
    };
  } catch (error) {
    if (error instanceof ShareLimitError || (error instanceof Error && error.message === "SHARE_LIMIT")) {
      return {
        error: `You already have ${MAX_ACTIVE_UNIT_SHARES} active links for this unit. Revoke one to create another.`,
      };
    }
    console.error("Could not create share link", error instanceof Error ? error.message : "unknown");
    return { error: "Could not create the share link." };
  }
}

export async function revokeUnitShareAction(formData: FormData): Promise<void> {
  const session = await requireBrowse();
  const id = String(formData.get("shareId") ?? "").trim();
  const unitId = String(formData.get("unitId") ?? "").trim();
  if (!id || !getListing(unitId)) return;
  try {
    await revokeUnitShare({
      id,
      actorUserId: session.userId,
      actorIsAdmin: session.role === "admin",
    });
  } catch (error) {
    console.error("Could not revoke share link", error instanceof Error ? error.message : "unknown");
    return;
  }
  revalidatePath(`/units/${unitId}`);
}
