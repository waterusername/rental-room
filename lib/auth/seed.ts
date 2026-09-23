import { findUserByEmail, insertUser } from "./db";
import { hashPassword } from "./password";

export async function ensureAdminSeed(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 10) return;
  const existing = await findUserByEmail(email);
  if (existing) {
    if (existing.role !== "admin") {
      console.error("ADMIN_EMAIL already belongs to a non-admin account. The administrator was not created.");
    }
    return;
  }
  try {
    await insertUser({
      email,
      name: "Administrator",
      company: null,
      passwordHash: await hashPassword(password),
      role: "admin",
      active: true,
      mustResetPassword: false,
      billingStatus: "complimentary",
    });
  } catch (error) {
    const raced = await findUserByEmail(email);
    if (raced) return;
    throw error;
  }
}
