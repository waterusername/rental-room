export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return { ok: false, error: "Send the showing as JSON." };
  }
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, error: "Send the showing as JSON." };
  }
}

/** Browser mutations include Origin. A different host is rejected. Missing Origin is allowed. */
export function crossSiteRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || request.headers.get("host")?.trim();
  if (!host) return true;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
