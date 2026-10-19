import { claimedUnitIds } from "../claim-unit.ts";
import { findListing, isReservedListing } from "../inventory.ts";
import {
  parseShowingWrite,
  parseUnitId,
  statsForUnits,
  unexpectedShowingField,
  type ShowingRecord,
  type UnitShowingStat,
} from "../showings.ts";
import { viewerCanBrowse } from "./config.ts";
import {
  deleteShowingRecord,
  findShowingRecord,
  insertShowingRecord,
  listShowingRecords,
  showingCountsByUnit,
  updateShowingRecord,
} from "./db.ts";
import type { AuthSession, Role } from "./types.ts";

export type ShowingActor = {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  mustResetPassword: boolean;
  billingStatus: AuthSession["billingStatus"];
  selfSignup: boolean;
};

export type ShowingListQuery = {
  unitId?: string | null;
  brokerId?: string | null;
};

type ErrorBody = { error: string };
type ServiceResult<T> = { status: number; body: T };

export function actorFromSession(session: AuthSession | null): ShowingActor | null {
  if (!session) return null;
  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    mustResetPassword: session.mustResetPassword,
    billingStatus: session.billingStatus,
    selfSignup: session.selfSignup,
  };
}

export async function createShowingForActor(
  actor: ShowingActor | null,
  body: unknown,
  now = Date.now(),
): Promise<ServiceResult<{ showing: ShowingRecord } | ErrorBody>> {
  const ready = readyActor(actor);
  if (!ready.ok) return ready.result;
  const record = readObject(body);
  if (!record) return { status: 400, body: { error: "Send the showing as JSON." } };
  const unexpected = unexpectedShowingField(record, "create");
  if (unexpected) return { status: 400, body: { error: unexpected } };

  const unit = parseUnitId(record.unitId);
  if (!unit.ok) return { status: 400, body: { error: unit.error } };
  const parsed = parseShowingWrite(record, now);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };

  const onBoard = await unitOnBoard(unit.unitId);
  if (!onBoard) return { status: 400, body: { error: "That unit is not on the board." } };

  try {
    const showing = await insertShowingRecord({
      unitId: onBoard.id,
      userId: ready.actor.userId,
      userEmail: ready.actor.email.trim().toLowerCase(),
      shownAt: parsed.value.shownAt,
      prospectFirstName: parsed.value.prospectFirstName,
      outcome: parsed.value.outcome,
      note: parsed.value.note,
    });
    return { status: 201, body: { showing } };
  } catch (error) {
    console.error("Could not save showing", error instanceof Error ? error.message : "unknown");
    return { status: 500, body: { error: "Could not save the showing." } };
  }
}

export async function listShowingsForActor(
  actor: ShowingActor | null,
  query: ShowingListQuery,
): Promise<ServiceResult<{ showings: ShowingRecord[] } | ErrorBody>> {
  const ready = readyActor(actor);
  if (!ready.ok) return ready.result;
  const unitId = optionalId(query.unitId);
  if (!unitId.ok) return { status: 400, body: { error: "Choose a unit." } };
  const brokerId = optionalId(query.brokerId);
  if (!brokerId.ok) return { status: 400, body: { error: "Choose a broker." } };

  if (!ready.actorIsAdmin) {
    if (brokerId.value && brokerId.value !== ready.actor.userId) {
      return { status: 403, body: { error: "You can only see your own showings." } };
    }
  }

  const showings = await listShowingRecords({
    userId: ready.actorIsAdmin ? brokerId.value : ready.actor.userId,
    unitId: unitId.value,
  });
  return { status: 200, body: { showings } };
}

export async function readShowingForActor(
  actor: ShowingActor | null,
  id: string,
): Promise<ServiceResult<{ showing: ShowingRecord } | ErrorBody>> {
  const ready = readyActor(actor);
  if (!ready.ok) return ready.result;
  const showing = await visibleShowing(ready, id);
  if (!showing) return { status: 404, body: { error: "Showing not found." } };
  return { status: 200, body: { showing } };
}

export async function updateShowingForActor(
  actor: ShowingActor | null,
  id: string,
  body: unknown,
  now = Date.now(),
): Promise<ServiceResult<{ showing: ShowingRecord } | ErrorBody>> {
  const ready = readyActor(actor);
  if (!ready.ok) return ready.result;
  const record = readObject(body);
  if (!record) return { status: 400, body: { error: "Send the showing as JSON." } };
  const unexpected = unexpectedShowingField(record, "update");
  if (unexpected) return { status: 400, body: { error: unexpected } };
  const existing = await visibleShowing(ready, id);
  if (!existing) return { status: 404, body: { error: "Showing not found." } };
  const parsed = parseShowingWrite(record, now);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };

  const showing = await updateShowingRecord({
    id: existing.id,
    actorUserId: ready.actor.userId,
    actorIsAdmin: ready.actorIsAdmin,
    shownAt: parsed.value.shownAt,
    prospectFirstName: parsed.value.prospectFirstName,
    outcome: parsed.value.outcome,
    note: parsed.value.note,
  });
  if (!showing) return { status: 404, body: { error: "Showing not found." } };
  return { status: 200, body: { showing } };
}

export async function deleteShowingForActor(
  actor: ShowingActor | null,
  id: string,
): Promise<ServiceResult<{ ok: true } | ErrorBody>> {
  const ready = readyActor(actor);
  if (!ready.ok) return ready.result;
  const existing = await visibleShowing(ready, id);
  if (!existing) return { status: 404, body: { error: "Showing not found." } };
  const deleted = await deleteShowingRecord({
    id: existing.id,
    actorUserId: ready.actor.userId,
    actorIsAdmin: ready.actorIsAdmin,
  });
  if (!deleted) return { status: 404, body: { error: "Showing not found." } };
  return { status: 200, body: { ok: true } };
}

export async function showingStatsForUnits(unitIds: string[]): Promise<Record<string, UnitShowingStat>> {
  const counts = await showingCountsByUnit();
  return statsForUnits(unitIds, counts);
}

type Ready =
  | { ok: true; actor: ShowingActor; actorIsAdmin: boolean }
  | { ok: false; result: ServiceResult<ErrorBody> };

function readyActor(actor: ShowingActor | null): Ready {
  if (!actor) return { ok: false, result: { status: 401, body: { error: "Sign in required." } } };
  if (actor.mustResetPassword) {
    return { ok: false, result: { status: 403, body: { error: "Choose a new password before logging showings." } } };
  }
  if (actor.role !== "admin" && actor.role !== "broker") {
    return { ok: false, result: { status: 403, body: { error: "Showings are limited to brokers and administrators." } } };
  }
  if (!viewerCanBrowse(actor)) {
    return { ok: false, result: { status: 403, body: { error: "Showings open when your account can open the boards." } } };
  }
  return { ok: true, actor, actorIsAdmin: actor.role === "admin" };
}

async function visibleShowing(ready: { actor: ShowingActor; actorIsAdmin: boolean }, id: string): Promise<ShowingRecord | null> {
  const parsed = parseUnitId(id);
  if (!parsed.ok) return null;
  const showing = await findShowingRecord(parsed.unitId);
  if (!showing) return null;
  if (!ready.actorIsAdmin && showing.userId !== ready.actor.userId) return null;
  return showing;
}

async function unitOnBoard(unitId: string): Promise<{ id: string } | null> {
  const listing = findListing(unitId);
  if (!listing) return null;
  const claimed = await claimedUnitIds();
  if (isReservedListing(listing, claimed)) return null;
  return { id: listing.id };
}

function readObject(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

function optionalId(value: string | null | undefined): { ok: true; value: string | null } | { ok: false } {
  if (value == null) return { ok: true, value: null };
  const text = value.trim();
  if (!text) return { ok: true, value: null };
  const parsed = parseUnitId(text);
  if (!parsed.ok) return { ok: false };
  return { ok: true, value: parsed.unitId };
}
