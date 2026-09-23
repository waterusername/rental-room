import { NextResponse, type NextRequest } from "next/server";
import { databaseConfig, SESSION_COOKIE, viewerCanBrowse } from "@/lib/auth/config";
import { readSession } from "@/lib/auth/db";
import { safeNextPath } from "@/lib/auth/http";
import type { AuthSession } from "@/lib/auth/types";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let session: AuthSession | null = null;
  if (token && databaseConfig()) {
    try {
      session = await readSession(token);
    } catch (error) {
      console.error("Access check failed", error instanceof Error ? error.message : "unknown");
      if (pathname === "/login") return NextResponse.next();
      return deny(request, "unavailable");
    }
  }

  if (pathname === "/login") {
    if (!session) return NextResponse.next();
    if (session.mustResetPassword) {
      return NextResponse.redirect(new URL("/account/password", request.url));
    }
    const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
    if (!viewerCanBrowse(session)) {
      return NextResponse.redirect(new URL("/account/billing", request.url));
    }
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  if (!databaseConfig()) return deny(request, "setup");
  if (!session) return deny(request, null);

  if (session.mustResetPassword && !pathname.startsWith("/account/password")) {
    const url = new URL("/account/password", request.url);
    if (isPage(pathname)) url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/account", request.url));
  }

  if (isAsset(pathname)) {
    if (!viewerCanBrowse(session) || session.mustResetPassword) {
      return new NextResponse(null, { status: 401 });
    }
    return NextResponse.next();
  }

  if (needsBoard(pathname) && !viewerCanBrowse(session)) {
    return NextResponse.redirect(new URL("/account/billing", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|favicon.ico|icon.svg).*)"],
};

function isPublic(pathname: string): boolean {
  return pathname === "/api/stripe/webhook";
}

function isAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/street-view/") ||
    pathname.startsWith("/exteriors/") ||
    pathname.startsWith("/layouts/") ||
    pathname.startsWith("/_next/image")
  );
}

function isPage(pathname: string): boolean {
  return !pathname.startsWith("/api/") && !pathname.startsWith("/_next/");
}

function needsBoard(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/account")) return false;
  if (pathname.startsWith("/api/")) return false;
  if (isAsset(pathname)) return false;
  return true;
}

function deny(request: NextRequest, error: "setup" | "unavailable" | null) {
  const { pathname } = request.nextUrl;
  if (isAsset(pathname) || pathname.startsWith("/api/")) {
    return new NextResponse(null, { status: 401 });
  }
  const url = new URL("/login", request.url);
  if (error) url.searchParams.set("error", error);
  if (isPage(pathname) && pathname !== "/login") {
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  }
  return NextResponse.redirect(url);
}
