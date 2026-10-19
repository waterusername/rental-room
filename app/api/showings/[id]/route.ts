import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/guards";
import { crossSiteRequest, readJsonBody } from "@/lib/auth/showing-route";
import {
  actorFromSession,
  deleteShowingForActor,
  readShowingForActor,
  updateShowingForActor,
} from "@/lib/auth/showings-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  const { id } = await context.params;
  const result = await readShowingForActor(actorFromSession(session), id);
  return NextResponse.json(result.body, { status: result.status });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (crossSiteRequest(request)) return NextResponse.json({ error: "That request was rejected." }, { status: 403 });
  const session = await getCurrentSession();
  const payload = await readJsonBody(request);
  if (!payload.ok) return NextResponse.json({ error: payload.error }, { status: 400 });
  const { id } = await context.params;
  const result = await updateShowingForActor(actorFromSession(session), id, payload.body);
  return NextResponse.json(result.body, { status: result.status });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (crossSiteRequest(request)) return NextResponse.json({ error: "That request was rejected." }, { status: 403 });
  const session = await getCurrentSession();
  const { id } = await context.params;
  const result = await deleteShowingForActor(actorFromSession(session), id);
  return NextResponse.json(result.body, { status: result.status });
}
