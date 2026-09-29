"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { claimUnitForBroker } from "../claim-unit.ts";
import { requireBrowse } from "./guards";
import type { ActionState } from "./types";

export async function claimUnitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireBrowse();
  const result = await claimUnitForBroker({
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    unitId: String(formData.get("unitId") ?? ""),
    note: formData.get("note"),
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/");
  revalidatePath("/reserved");
  revalidatePath(`/units/${result.claim.unitId}`);
  redirect("/?claimed=1");
}
