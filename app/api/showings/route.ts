import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/guards";
import { crossSiteRequest, readJsonBody } from "@/lib/auth/showing-route";
import { actorFromSession, createShowingForActor, listShowingsForActor } from "@/lib/auth/showings-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  const url = new URL(request.url);
  const result = await listShowingsForActor(actorFromSession(session), {
    unitId: url.searchParams.get("unitId"),
    brokerId: url.searchParams.get("brokerId"),
  });
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const blocked = crossSiteRequest(request);
  if (blocked) return NextResponse.json({ error: "That request was rejected." }, { status: 403 });
  const session = await getCurrentSession();
  const payload = await readJsonBody(request);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: 400 });
  const result = await createShowingForActor(actorFromSession(session), payload.body);
  return NextResponse.json(result.body, { status: result.status });
}
