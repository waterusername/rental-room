"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  databaseConfig,
  FAILURE_WINDOW_MS,
  isOfficeAccount,
  MAX_FAILURES_PER_EMAIL,
  MAX_FAILURES_PER_IP,
  MAX_SIGNUPS_PER_EMAIL,
  MAX_SIGNUPS_PER_IP,
  paymentsEnforced,
  postLoginPath,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "./config";
import {
  countRecentFailures,
  countRecentSignupAttempts,
  createSession,
  findUserByEmail,
  findUserById,
  insertUser,
  recordLoginEvent,
  recordSignupAttempt,
  revokeOtherSessions,
  revokeSessionByToken,
  setUserPassword,
} from "./db";
import { requireUser } from "./guards";
import { normalizeEmail, passwordError, requestMeta, safeNextPath } from "./http";
import { hashPassword, verifyPassword } from "./password";
import { ensureAdminSeed } from "./seed";
import { parseSignupForm, selfSignupRecord } from "./signup";
import { createCheckoutUrl } from "./stripe";
import type { ActionState, LoginState } from "./types";

function sessionCookie(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const nextPath = safeNextPath(String(formData.get("next") ?? ""));
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  if (!databaseConfig()) {
    return { error: "Sign-in is unavailable until the access database is configured." };
  }

  let meta: ReturnType<typeof requestMeta>;
  try {
    meta = requestMeta(await headers());
    await ensureAdminSeed();
  } catch (error) {
    console.error("Sign-in setup failed", error instanceof Error ? error.message : "unknown");
    return { error: "The access database is not reachable." };
  }

  const since = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString();
  const [emailFailures, ipFailures] = await Promise.all([
    countRecentFailures({ email, sinceIso: since }),
    countRecentFailures({ ip: meta.ip, sinceIso: since }),
  ]);
  if (emailFailures >= MAX_FAILURES_PER_EMAIL || ipFailures >= MAX_FAILURES_PER_IP) {
    return { error: "Too many sign-in attempts. Try again in a few minutes." };
  }

  const user = await findUserByEmail(email);
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !passwordOk) {
    await recordLoginEvent({ userId: user?.id ?? null, email, success: false, meta });
    return { error: "Invalid email or password." };
  }
  if (!user.active) {
    await recordLoginEvent({ userId: user.id, email, success: false, meta });
    return { error: "This account is disabled. Contact the office." };
  }

  const created = await createSession(user.id, meta);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, created.token, sessionCookie(Math.floor(SESSION_TTL_MS / 1000)));
  redirect(
    postLoginPath({
      mustResetPassword: user.mustResetPassword,
      role: user.role,
      billingStatus: user.billingStatus,
      email: user.email,
      selfSignup: user.selfSignup,
      nextPath,
      stripeOn: paymentsEnforced(),
    }),
  );
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await revokeSessionByToken(token);
    } catch (error) {
      console.error("Could not revoke session", error instanceof Error ? error.message : "unknown");
    }
  }
  jar.set(SESSION_COOKIE, "", sessionCookie(0));
  redirect("/login");
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const nextPath = safeNextPath(String(formData.get("next") ?? ""));
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const nextError = passwordError(next);
  if (nextError) return { error: nextError };
  if (next !== confirm) return { error: "New password and confirmation do not match." };
  if (next === current) return { error: "Choose a password that is different from the current one." };

  const user = await findUserById(session.userId);
  if (!user || !user.active) return { error: "This account is disabled. Contact the office." };
  const matches = await verifyPassword(current, user.passwordHash);
  if (!matches) return { error: "Current password is incorrect." };

  await setUserPassword(user.id, await hashPassword(next), false);
  await revokeOtherSessions(user.id, session.sessionId);
  redirect(
    postLoginPath({
      mustResetPassword: false,
      role: user.role,
      billingStatus: user.billingStatus,
      email: user.email,
      selfSignup: user.selfSignup,
      nextPath,
      stripeOn: paymentsEnforced(),
    }),
  );
}

const EMAIL_TAKEN = "An account with this email already exists.";

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseSignupForm(formData);
  if (!parsed.ok) {
    if (parsed.honeypot && databaseConfig()) {
      try {
        const meta = requestMeta(await headers());
        await recordSignupAttempt({ ip: meta.ip, email: null });
      } catch (error) {
        console.error("Sign-up attempt was not recorded", error instanceof Error ? error.message : "unknown");
      }
    }
    return { error: parsed.error };
  }
  if (!databaseConfig()) {
    return { error: "Sign-up is unavailable until the access database is configured." };
  }

  const nextPath = safeNextPath(String(formData.get("next") ?? ""));
  try {
    const meta = requestMeta(await headers());
    const since = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString();
    const [emailAttempts, ipAttempts] = await Promise.all([
      countRecentSignupAttempts({ email: parsed.email, sinceIso: since }),
      countRecentSignupAttempts({ ip: meta.ip, sinceIso: since }),
    ]);
    if (emailAttempts >= MAX_SIGNUPS_PER_EMAIL || ipAttempts >= MAX_SIGNUPS_PER_IP) {
      return { error: "Too many sign-up attempts. Try again in a few minutes." };
    }
    await recordSignupAttempt({ ip: meta.ip, email: parsed.email });

    const existing = await findUserByEmail(parsed.email);
    if (existing) return { error: EMAIL_TAKEN, emailTaken: true };

    const created = await insertUser(
      selfSignupRecord({
        email: parsed.email,
        name: parsed.name,
        phone: parsed.phone,
        company: parsed.company,
        passwordHash: await hashPassword(parsed.password),
        termsAcceptedAt: new Date().toISOString(),
      }),
    );
    const session = await createSession(created.id, meta);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, session.token, sessionCookie(Math.floor(SESSION_TTL_MS / 1000)));
    revalidatePath("/admin");

    const stripeOn = paymentsEnforced();
    if (stripeOn) {
      try {
        const url = await createCheckoutUrl(created);
        redirect(url);
      } catch (error) {
        if (isRedirect(error)) throw error;
        console.error("Checkout failed", error instanceof Error ? error.message : "unknown");
        redirect("/account/billing");
      }
    }

    redirect(
      postLoginPath({
        mustResetPassword: false,
        role: created.role,
        billingStatus: created.billingStatus,
        email: created.email,
        selfSignup: true,
        nextPath,
        stripeOn,
      }),
    );
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (await emailAlreadyExists(parsed.email, error)) return { error: EMAIL_TAKEN, emailTaken: true };
    console.error("Sign-up failed", error instanceof Error ? error.message : "unknown");
    return { error: "The access database is not reachable." };
  }
}

async function emailAlreadyExists(email: string, error: unknown): Promise<boolean> {
  if (!isUniqueConstraint(error)) return false;
  try {
    return Boolean(await findUserByEmail(email));
  } catch {
    return true;
  }
}

function isUniqueConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /unique constraint failed/i.test(message) || message.includes("SQLITE_CONSTRAINT");
}

export async function startMyCheckout(prev: ActionState, formData: FormData): Promise<ActionState> {
  void prev;
  void formData;
  const session = await requireUser();
  if (session.mustResetPassword) redirect("/account/password");
  const user = await findUserById(session.userId);
  if (!user || !user.active) return { error: "This account cannot start checkout." };
  if (isOfficeAccount(user)) {
    return { error: "Grinberg office accounts are complimentary and are not billed." };
  }
  if (user.role === "admin") redirect("/admin");
  try {
    const url = await createCheckoutUrl(user);
    redirect(url);
  } catch (error) {
    if (isRedirect(error)) throw error;
    console.error("Checkout failed", error instanceof Error ? error.message : "unknown");
    return { error: error instanceof Error ? error.message : "Could not start checkout." };
  }
}

function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
