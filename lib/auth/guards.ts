import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { databaseConfig, SESSION_COOKIE, viewerCanBrowse } from "./config";
import { readSession } from "./db";
import type { AuthSession } from "./types";

export async function getCurrentSession(): Promise<AuthSession | null> {
  if (!databaseConfig()) return null;
  try {
    const jar = await cookies();
    return await readSession(jar.get(SESSION_COOKIE)?.value);
  } catch (error) {
    console.error("Session lookup failed", error instanceof Error ? error.message : "unknown");
    return null;
  }
}

export async function requireUser(): Promise<AuthSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireBrowse(): Promise<AuthSession> {
  const session = await requireUser();
  if (session.mustResetPassword) redirect("/account/password");
  if (!viewerCanBrowse(session)) redirect("/account/billing");
  return session;
}

export async function requireAdmin(): Promise<AuthSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/admin");
  if (session.mustResetPassword) redirect("/account/password");
  if (session.role !== "admin") redirect("/account");
  return session;
}
