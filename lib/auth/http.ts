import { createHash } from "node:crypto";
import type { RequestMeta } from "./types";

export function clientIp(headerList: { get(name: string): string | null }): string {
  const vercel = firstHeaderValue(headerList.get("x-vercel-forwarded-for"));
  if (vercel) return vercel;
  const real = headerList.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = firstHeaderValue(headerList.get("x-forwarded-for"));
  if (forwarded) return forwarded;
  return "unknown";
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const ip = value.split(",")[0]?.trim();
  return ip || null;
}

export function sessionFingerprint(userAgent: string, acceptLanguage: string): string {
  return createHash("sha256").update(`${userAgent}\n${acceptLanguage}`).digest("hex").slice(0, 16);
}

export function requestMeta(headerList: { get(name: string): string | null }): RequestMeta {
  const userAgent = (headerList.get("user-agent") ?? "").slice(0, 512);
  const acceptLanguage = (headerList.get("accept-language") ?? "").slice(0, 256);
  return {
    ip: clientIp(headerList),
    userAgent,
    acceptLanguage,
    fingerprint: sessionFingerprint(userAgent, acceptLanguage),
  };
}

export function safeNextPath(input: string | null | undefined): string {
  if (!input) return "/";
  const value = input.trim();
  if (value.length === 0 || value.length > 512) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.includes("\\") || value.includes("\n") || value.includes("\r")) return "/";
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/";
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("://") || decoded.includes("\\")) {
    return "/";
  }
  if (value.startsWith("/login")) return "/";
  return value;
}

export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "—";
  const stamp = new Date(time).toISOString();
  return `${stamp.slice(0, 10)} ${stamp.slice(11, 16)} UTC`;
}

export function summarizeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown client";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Other browser";
  const os = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Unknown OS";
  return `${browser} · ${os}`;
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function passwordError(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 128) return "Use at most 128 characters.";
  return null;
}
