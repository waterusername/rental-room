"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readCompletedRentalForm } from "../completed-rentals.ts";
import { deleteCompletedRental, insertCompletedRental, updateCompletedRental } from "./db";
import { requireAdmin } from "./guards";
import type { ActionState } from "./types";

function refresh(id?: string) {
  revalidatePath("/admin/completed");
  if (id) revalidatePath(`/admin/completed/${id}`);
}

export async function createCompletedRentalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = readCompletedRentalForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  await insertCompletedRental(parsed.value);
  refresh();
  return { ok: "Completed rental added." };
}

export async function updateCompletedRentalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "That rental was not found." };
  const parsed = readCompletedRentalForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const saved = await updateCompletedRental(id, parsed.value);
  if (!saved) return { error: "That rental was not found." };
  refresh(id);
  return { ok: "Saved." };
}

export async function deleteCompletedRentalAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (id) await deleteCompletedRental(id);
  refresh(id || undefined);
  redirect("/admin/completed");
}
