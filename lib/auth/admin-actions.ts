"use server";

import { revalidatePath } from "next/cache";
import {
  findUserByEmail,
  findUserById,
  insertUser,
  revokeUserSessions,
  setUserActive,
  setUserPassword,
  updateBrokerProfile,
} from "./db";
import { isOfficeAccount } from "./config";
import { requireAdmin } from "./guards";
import { normalizeEmail, passwordError } from "./http";
import { generateTemporaryPassword, hashPassword } from "./password";
import { isGrinbergAdminEmail } from "./staff";
import { checkoutForUserId } from "./stripe";
import { BILLING_STATUSES, type ActionState, type BillingStatus, type Role } from "./types";

function refresh(userId?: string) {
  revalidatePath("/admin");
  if (userId) revalidatePath(`/admin/brokers/${userId}`);
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 160) : null;
}

function parseBilling(value: string): BillingStatus | null {
  return BILLING_STATUSES.includes(value as BillingStatus) ? (value as BillingStatus) : null;
}

export async function createBrokerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { error: "Enter a valid email address." };
  const name = blankToNull(String(formData.get("name") ?? ""));
  const company = blankToNull(String(formData.get("company") ?? ""));
  const requested = parseBilling(String(formData.get("billingStatus") ?? "payment_required"));
  if (!requested) return { error: "Choose a billing status." };
  const typed = String(formData.get("password") ?? "");
  const temporary = typed.trim() ? typed : generateTemporaryPassword();
  const issue = passwordError(temporary);
  if (issue) return { error: issue };
  const existing = await findUserByEmail(email);
  if (existing) return { error: "An account with that email already exists." };

  const office = isGrinbergAdminEmail(email);
  const billingStatus: BillingStatus = office ? "complimentary" : requested;
  const role: Role = office ? "admin" : "broker";
  const created = await insertUser({
    email,
    name: name?.slice(0, 120) ?? null,
    company,
    passwordHash: await hashPassword(temporary),
    role,
    active: true,
    mustResetPassword: true,
    billingStatus,
    createdBy: admin.userId,
  });
  refresh(created.id);
  return {
    ok: office
      ? `Office account created for ${created.email}. Grinberg office accounts are complimentary and are not billed. Share the temporary password once. It cannot be shown again.`
      : `Broker account created for ${created.email}. Share the temporary password once. It cannot be shown again.`,
    tempPassword: temporary,
  };
}

export async function updateBrokerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("userId") ?? "");
  const user = await findUserById(id);
  if (!user) return { error: "That account was not found." };
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { error: "Enter a valid email address." };
  const requested = parseBilling(String(formData.get("billingStatus") ?? ""));
  if (!requested) return { error: "Choose a billing status." };
  if (isOfficeAccount(user) && email !== user.email) {
    return { error: "A Grinberg office account keeps its email and is not billed." };
  }
  const other = await findUserByEmail(email);
  if (other && other.id !== user.id) return { error: "An account with that email already exists." };
  const office = isGrinbergAdminEmail(email) && !user.selfSignup;
  await updateBrokerProfile({
    id: user.id,
    email,
    name: blankToNull(String(formData.get("name") ?? ""))?.slice(0, 120) ?? null,
    company: blankToNull(String(formData.get("company") ?? "")),
    billingStatus: office ? "complimentary" : requested,
    ...(office ? { role: "admin" as const } : {}),
  });
  refresh(user.id);
  return {
    ok: office ? "Office account saved. It stays complimentary and is not billed." : "Account saved.",
  };
}

export async function setBrokerActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "1";
  if (id === admin.userId && !active) return { error: "You cannot disable your own account." };
  const user = await findUserById(id);
  if (!user) return { error: "That account was not found." };
  await setUserActive(id, active);
  if (!active) await revokeUserSessions(id);
  refresh(id);
  return { ok: active ? "Account enabled." : "Account disabled and sessions ended." };
}

export async function forceLogoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("userId") ?? "");
  if (id === admin.userId) return { error: "Use Log out to end your own session." };
  const user = await findUserById(id);
  if (!user) return { error: "That account was not found." };
  await revokeUserSessions(id);
  refresh(id);
  return { ok: "All sessions for this account were ended." };
}

export async function resetBrokerPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("userId") ?? "");
  if (id === admin.userId) return { error: "Change your own password from Account." };
  const user = await findUserById(id);
  if (!user) return { error: "That account was not found." };
  const temporary = generateTemporaryPassword();
  await setUserPassword(user.id, await hashPassword(temporary), true);
  await revokeUserSessions(user.id);
  refresh(user.id);
  return {
    ok: "Temporary password set. Existing sessions were ended. The broker must choose a new password at the next sign-in.",
    tempPassword: temporary,
  };
}

export async function createCheckoutLinkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("userId") ?? "");
  const user = await findUserById(id);
  if (!user || user.role !== "broker" || isOfficeAccount(user)) {
    return { error: "Checkout links are for outside brokers. Grinberg office accounts are complimentary." };
  }
  try {
    const checkoutUrl = await checkoutForUserId(user.id);
    return {
      ok: "Checkout link created. It expires after Stripe’s usual checkout window (about 24 hours).",
      checkoutUrl,
    };
  } catch (error) {
    console.error("Could not create checkout link", error instanceof Error ? error.message : "unknown");
    return { error: error instanceof Error ? error.message : "Could not create a checkout link." };
  }
}
