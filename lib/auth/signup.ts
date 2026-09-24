import { normalizeEmail, passwordError } from "./http.ts";
import type { BillingStatus, Role } from "./types.ts";

export type SelfSignupRecord = {
  email: string;
  name: string;
  company: string | null;
  phone: string;
  passwordHash: string;
  role: Role;
  active: true;
  mustResetPassword: false;
  billingStatus: BillingStatus;
  createdBy: null;
  termsAcceptedAt: string;
  selfSignup: true;
};

export type SignupParseResult =
  | {
      ok: true;
      name: string;
      email: string;
      phone: string;
      company: string | null;
      password: string;
    }
  | { ok: false; error: string; honeypot?: boolean };

/**
 * Public sign-up always creates an outside broker who still needs to pay.
 * The email is stored and is never used to grant administrator or complimentary access.
 */
export function selfSignupRecord(input: {
  email: string;
  name: string;
  phone: string;
  company: string | null;
  passwordHash: string;
  termsAcceptedAt: string;
}): SelfSignupRecord {
  return {
    email: input.email,
    name: input.name,
    phone: input.phone,
    company: input.company,
    passwordHash: input.passwordHash,
    termsAcceptedAt: input.termsAcceptedAt,
    createdBy: null,
    role: "broker",
    active: true,
    mustResetPassword: false,
    billingStatus: "payment_required",
    selfSignup: true,
  };
}

export function parseSignupForm(formData: FormData): SignupParseResult {
  if (String(formData.get("fax") ?? "").trim()) {
    return { ok: false, honeypot: true, error: "Could not create the account. Try again." };
  }

  const name = cleanText(String(formData.get("name") ?? ""), 120);
  if (!name || name.length < 2) return { ok: false, error: "Enter your full name." };

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { ok: false, error: "Enter a valid email address." };

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) return { ok: false, error: "Enter a phone number with at least 10 digits." };

  const companyRaw = String(formData.get("company") ?? "");
  const company = companyRaw.trim() ? cleanText(companyRaw, 160) : null;
  if (companyRaw.trim() && !company) return { ok: false, error: "Enter a shorter company name." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const issue = passwordError(password);
  if (issue) return { ok: false, error: issue };
  if (password !== confirm) return { ok: false, error: "Password and confirmation do not match." };

  if (String(formData.get("terms") ?? "") !== "yes") {
    return { ok: false, error: "Agree to the broker terms to create an account." };
  }

  return { ok: true, name, email, phone, company, password };
}

export function normalizePhone(value: string): string | null {
  const phone = value.trim().replace(/\s+/g, " ");
  if (phone.length < 7 || phone.length > 40) return null;
  if (!/^[0-9+().\-\s]+$/.test(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return phone;
}

function cleanText(value: string, max: number): string | null {
  const cleaned = value
    .replace(/[\u0000-\u001F]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > max) return null;
  return cleaned;
}
