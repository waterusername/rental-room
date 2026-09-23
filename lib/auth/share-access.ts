/**
 * Single-unit share links. The token is the only anonymous credential.
 * It is stored as a SHA-256 hash. A unit slug is not accepted as a token.
 * Every other route still requires a broker session.
 */

import { viewerCanBrowse } from "./config";
import type { BillingStatus, Role } from "./types";

export const SHARE_TTL_DAYS = 14;
export const SHARE_TTL_MS = SHARE_TTL_DAYS * 24 * 60 * 60 * 1000;
export const MAX_ACTIVE_UNIT_SHARES = 20;

const TOKEN = "[A-Za-z0-9_-]{43}";
const SHARE_PATH = new RegExp(
  `^/s/${TOKEN}/?$|^/s/${TOKEN}/exterior/?$|^/s/${TOKEN}/plan/\\d{1,2}/?$`,
);

export class ShareLimitError extends Error {
  constructor() {
    super("SHARE_LIMIT");
    this.name = "ShareLimitError";
  }
}

export function isShareToken(token: string): boolean {
  return new RegExp(`^${TOKEN}$`).test(token);
}

/** Paths an anonymous visitor may reach. The handler still checks the token. */
export function isAnonymousSharePath(pathname: string): boolean {
  return SHARE_PATH.test(pathname);
}

export function shareLink(origin: string, token: string): string {
  const base = origin.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(base) || /[?#\s]/.test(base)) {
    throw new Error("Invalid share origin");
  }
  if (!isShareToken(token)) throw new Error("Invalid share token");
  return `${base}/s/${token}`;
}

export function shareIsActive(
  share: { expiresAt: string; revokedAt: string | null },
  now: number,
): boolean {
  if (share.revokedAt) return false;
  const expires = Date.parse(share.expiresAt);
  if (!Number.isFinite(expires) || expires <= now) return false;
  return true;
}

/** Same browse rule as the boards, plus the account must still be active. */
export function shareCreatorStillAllows(
  user: { active: boolean; role: Role; billingStatus: BillingStatus; email?: string | null } | null,
): boolean {
  if (!user?.active) return false;
  return viewerCanBrowse(user);
}
