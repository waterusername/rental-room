import { mkdirSync } from "node:fs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import {
  databaseConfig,
  LAST_SEEN_WRITE_MS,
  SESSION_TTL_MS,
} from "./config";
import type {
  AuthSession,
  BillingStatus,
  LoginHistoryRow,
  PublicUser,
  RequestMeta,
  Role,
  UserRecord,
} from "./types";
import { GRINBERG_ADMIN_EMAILS, isGrinbergAdminEmail } from "./staff";
import { BILLING_STATUSES, ROLES } from "./types";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    company TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'broker')),
    active INTEGER NOT NULL DEFAULT 1,
    must_reset_password INTEGER NOT NULL DEFAULT 0,
    billing_status TEXT NOT NULL DEFAULT 'complimentary' CHECK (
      billing_status IN ('complimentary', 'payment_required', 'active_paid', 'past_due', 'canceled')
    ),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    revoked_at TEXT,
    ip TEXT,
    user_agent TEXT,
    accept_language TEXT,
    fingerprint TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS login_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    email TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    accept_language TEXT,
    fingerprint TEXT,
    session_id TEXT,
    success INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_login_events_user_time ON login_events (user_id, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS idx_login_events_email_time ON login_events (email, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS idx_login_events_ip_time ON login_events (ip, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)`,
];

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getClient(): Client {
  const config = databaseConfig();
  if (!config) {
    throw new Error("Database is not configured");
  }
  if (!client) {
    if (config.url.startsWith("file:")) {
      mkdirSync("data", { recursive: true });
    }
    client = createClient({
      url: config.url,
      ...(config.authToken ? { authToken: config.authToken } : {}),
    });
  }
  return client;
}

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = migrate().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function migrate(): Promise<void> {
  const db = getClient();
  for (const sql of SCHEMA) {
    await db.execute(sql);
  }
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
  await db.execute({
    sql: "DELETE FROM sessions WHERE expires_at < ? AND (revoked_at IS NOT NULL OR expires_at < ?)",
    args: [cutoff, cutoff],
  });
}

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  password_hash: string;
  role: string;
  active: number | bigint;
  must_reset_password: number | bigint;
  billing_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

function asRole(value: string): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "broker";
}

function asBilling(value: string): BillingStatus {
  return BILLING_STATUSES.includes(value as BillingStatus) ? (value as BillingStatus) : "complimentary";
}

function flag(value: number | bigint | null | undefined): boolean {
  return Number(value ?? 0) === 1;
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    company: row.company,
    passwordHash: row.password_hash,
    role: asRole(row.role),
    active: flag(row.active),
    mustResetPassword: flag(row.must_reset_password),
    billingStatus: asBilling(row.billing_status),
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    company: user.company,
    role: user.role,
    active: user.active,
    mustResetPassword: user.mustResetPassword,
    billingStatus: user.billingStatus,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    createdBy: user.createdBy,
  };
}

export async function countUsers(): Promise<number> {
  await ensureSchema();
  const result = await getClient().execute("SELECT COUNT(*) AS n FROM users");
  return Number(result.rows[0]?.n ?? 0);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureSchema();
  const result = await getClient().execute({
    sql: "SELECT * FROM users WHERE email = ?",
    args: [email],
  });
  const row = result.rows[0] as unknown as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  await ensureSchema();
  const result = await getClient().execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0] as unknown as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export async function listUsers(): Promise<UserRecord[]> {
  await ensureSchema();
  const result = await getClient().execute("SELECT * FROM users ORDER BY created_at ASC");
  return result.rows.map((row) => mapUser(row as unknown as UserRow));
}

export async function insertUser(input: {
  email: string;
  name: string | null;
  company: string | null;
  passwordHash: string;
  role: Role;
  active?: boolean;
  mustResetPassword?: boolean;
  billingStatus?: BillingStatus;
  createdBy?: string | null;
}): Promise<UserRecord> {
  await ensureSchema();
  const now = new Date().toISOString();
  const id = randomUUID();
  await getClient().execute({
    sql: `INSERT INTO users (
      id, email, name, company, password_hash, role, active, must_reset_password,
      billing_status, created_at, updated_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.email,
      input.name,
      input.company,
      input.passwordHash,
      input.role,
      input.active === false ? 0 : 1,
      input.mustResetPassword ? 1 : 0,
      input.billingStatus ?? "complimentary",
      now,
      now,
      input.createdBy ?? null,
    ],
  });
  const created = await findUserById(id);
  if (!created) throw new Error("Could not create the account");
  return created;
}

export async function updateBrokerProfile(input: {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  billingStatus: BillingStatus;
  role?: Role;
}): Promise<void> {
  await ensureSchema();
  const now = new Date().toISOString();
  if (input.role) {
    await getClient().execute({
      sql: `UPDATE users
        SET email = ?, name = ?, company = ?, billing_status = ?, role = ?, updated_at = ?
        WHERE id = ?`,
      args: [input.email, input.name, input.company, input.billingStatus, input.role, now, input.id],
    });
    return;
  }
  await getClient().execute({
    sql: `UPDATE users
      SET email = ?, name = ?, company = ?, billing_status = ?, updated_at = ?
      WHERE id = ?`,
    args: [input.email, input.name, input.company, input.billingStatus, now, input.id],
  });
}

/** Existing rows for the office list become complimentary administrators. Does not create accounts. */
export async function markGrinbergOfficeAccounts(): Promise<void> {
  await ensureSchema();
  const placeholders = GRINBERG_ADMIN_EMAILS.map(() => "?").join(", ");
  await getClient().execute({
    sql: `UPDATE users
      SET role = 'admin', billing_status = 'complimentary', updated_at = ?
      WHERE email IN (${placeholders})
        AND (role <> 'admin' OR billing_status <> 'complimentary')`,
    args: [new Date().toISOString(), ...GRINBERG_ADMIN_EMAILS],
  });
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: "UPDATE users SET active = ?, updated_at = ? WHERE id = ?",
    args: [active ? 1 : 0, new Date().toISOString(), id],
  });
}

export async function setUserPassword(id: string, passwordHash: string, mustResetPassword: boolean): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: "UPDATE users SET password_hash = ?, must_reset_password = ?, updated_at = ? WHERE id = ?",
    args: [passwordHash, mustResetPassword ? 1 : 0, new Date().toISOString(), id],
  });
}

export async function applyStripeBilling(input: {
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  billingStatus: BillingStatus;
}): Promise<boolean> {
  await ensureSchema();
  const user =
    (input.userId ? await findUserById(input.userId) : null) ??
    (input.subscriptionId ? await findUserByStripe("stripe_subscription_id", input.subscriptionId) : null) ??
    (input.customerId ? await findUserByStripe("stripe_customer_id", input.customerId) : null);
  if (!user) return false;
  const billingStatus = isGrinbergAdminEmail(user.email) ? "complimentary" : input.billingStatus;
  await getClient().execute({
    sql: `UPDATE users
      SET billing_status = ?,
          stripe_customer_id = COALESCE(?, stripe_customer_id),
          stripe_subscription_id = COALESCE(?, stripe_subscription_id),
          updated_at = ?
      WHERE id = ?`,
    args: [
      billingStatus,
      input.customerId ?? null,
      input.subscriptionId ?? null,
      new Date().toISOString(),
      user.id,
    ],
  });
  return true;
}

async function findUserByStripe(
  column: "stripe_customer_id" | "stripe_subscription_id",
  value: string,
): Promise<UserRecord | null> {
  const result = await getClient().execute({
    sql: `SELECT * FROM users WHERE ${column} = ?`,
    args: [value],
  });
  const row = result.rows[0] as unknown as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export async function countRecentFailures(input: {
  email?: string;
  ip?: string;
  sinceIso: string;
}): Promise<number> {
  await ensureSchema();
  if (!input.email && !input.ip) return 0;
  const column = input.email ? "email" : "ip";
  const value = input.email ?? input.ip ?? "";
  const result = await getClient().execute({
    sql: `SELECT COUNT(*) AS n FROM login_events WHERE success = 0 AND occurred_at >= ? AND ${column} = ?`,
    args: [input.sinceIso, value],
  });
  return Number(result.rows[0]?.n ?? 0);
}

export async function recordLoginEvent(input: {
  userId: string | null;
  email: string;
  success: boolean;
  meta: RequestMeta;
  sessionId?: string | null;
}): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: `INSERT INTO login_events (
      id, user_id, email, occurred_at, ip, user_agent, accept_language, fingerprint, session_id, success
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      randomUUID(),
      input.userId,
      input.email,
      new Date().toISOString(),
      input.meta.ip,
      input.meta.userAgent,
      input.meta.acceptLanguage,
      input.meta.fingerprint,
      input.sessionId ?? null,
      input.success ? 1 : 0,
    ],
  });
}

export async function createSession(userId: string, meta: RequestMeta): Promise<{ token: string; sessionId: string }> {
  await ensureSchema();
  const token = randomBytes(32).toString("base64url");
  const sessionId = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  await getClient().batch(
    [
      {
        sql: `INSERT INTO sessions (
          id, user_id, token_hash, created_at, expires_at, last_seen_at, ip, user_agent, accept_language, fingerprint
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          sessionId,
          userId,
          hashToken(token),
          now.toISOString(),
          expires.toISOString(),
          now.toISOString(),
          meta.ip,
          meta.userAgent,
          meta.acceptLanguage,
          meta.fingerprint,
        ],
      },
      {
        sql: `INSERT INTO login_events (
          id, user_id, email, occurred_at, ip, user_agent, accept_language, fingerprint, session_id, success
        ) SELECT ?, ?, email, ?, ?, ?, ?, ?, ?, 1 FROM users WHERE id = ?`,
        args: [
          randomUUID(),
          userId,
          now.toISOString(),
          meta.ip,
          meta.userAgent,
          meta.acceptLanguage,
          meta.fingerprint,
          sessionId,
          userId,
        ],
      },
    ],
    "write",
  );
  return { token, sessionId };
}

type SessionJoinRow = {
  session_id: string;
  expires_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  user_id: string;
  email: string;
  name: string | null;
  company: string | null;
  role: string;
  active: number | bigint;
  must_reset_password: number | bigint;
  billing_status: string;
};

export async function readSession(token: string | undefined | null): Promise<AuthSession | null> {
  if (!token || !databaseConfig()) return null;
  await ensureSchema();
  const result = await getClient().execute({
    sql: `SELECT
        s.id AS session_id,
        s.expires_at,
        s.last_seen_at,
        s.revoked_at,
        u.id AS user_id,
        u.email,
        u.name,
        u.company,
        u.role,
        u.active,
        u.must_reset_password,
        u.billing_status
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    args: [hashToken(token)],
  });
  const row = result.rows[0] as unknown as SessionJoinRow | undefined;
  if (!row) return null;
  if (row.revoked_at) return null;
  if (!flag(row.active)) return null;
  if (Date.parse(row.expires_at) <= Date.now()) return null;

  const lastSeen = Date.parse(row.last_seen_at);
  if (Number.isNaN(lastSeen) || Date.now() - lastSeen > LAST_SEEN_WRITE_MS) {
    try {
      await getClient().execute({
        sql: "UPDATE sessions SET last_seen_at = ? WHERE id = ?",
        args: [new Date().toISOString(), row.session_id],
      });
    } catch (error) {
      console.error("Could not update session activity", error instanceof Error ? error.message : "unknown");
    }
  }

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    company: row.company,
    role: asRole(row.role),
    mustResetPassword: flag(row.must_reset_password),
    billingStatus: asBilling(row.billing_status),
    expiresAt: row.expires_at,
  };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  if (!databaseConfig()) return;
  await ensureSchema();
  await getClient().execute({
    sql: "UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
    args: [new Date().toISOString(), hashToken(token)],
  });
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
    args: [new Date().toISOString(), userId],
  });
}

export async function revokeOtherSessions(userId: string, keepSessionId: string): Promise<void> {
  await ensureSchema();
  await getClient().execute({
    sql: "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL",
    args: [new Date().toISOString(), userId, keepSessionId],
  });
}

export type LoginAggregate = {
  userId: string;
  totalLogins: number;
  lastLoginAt: string | null;
  lastIp: string | null;
  distinctIps7: number;
  distinctIps30: number;
  failedLogins7: number;
};

export async function loginAggregates(since7: string, since30: string): Promise<Map<string, LoginAggregate>> {
  await ensureSchema();
  const db = getClient();
  const totals = await db.execute(
    `SELECT user_id, COUNT(*) AS n
     FROM login_events
     WHERE success = 1 AND user_id IS NOT NULL
     GROUP BY user_id`,
  );
  const latest = await db.execute(
    `SELECT user_id, ip, occurred_at
     FROM (
       SELECT user_id, ip, occurred_at,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY occurred_at DESC) AS rn
       FROM login_events
       WHERE success = 1 AND user_id IS NOT NULL
     )
     WHERE rn = 1`,
  );
  const distinct = async (since: string) =>
    db.execute({
      sql: `SELECT user_id, COUNT(DISTINCT ip) AS n
        FROM login_events
        WHERE success = 1 AND user_id IS NOT NULL AND occurred_at >= ?
          AND ip IS NOT NULL AND ip != 'unknown'
        GROUP BY user_id`,
      args: [since],
    });
  const [week, month, failed] = await Promise.all([
    distinct(since7),
    distinct(since30),
    db.execute({
      sql: `SELECT user_id, COUNT(*) AS n
        FROM login_events
        WHERE success = 0 AND user_id IS NOT NULL AND occurred_at >= ?
        GROUP BY user_id`,
      args: [since7],
    }),
  ]);

  const map = new Map<string, LoginAggregate>();
  const ensure = (userId: string) => {
    const current = map.get(userId);
    if (current) return current;
    const created: LoginAggregate = {
      userId,
      totalLogins: 0,
      lastLoginAt: null,
      lastIp: null,
      distinctIps7: 0,
      distinctIps30: 0,
      failedLogins7: 0,
    };
    map.set(userId, created);
    return created;
  };

  for (const row of totals.rows) {
    const userId = String(row.user_id);
    ensure(userId).totalLogins = Number(row.n ?? 0);
  }
  for (const row of latest.rows) {
    const stats = ensure(String(row.user_id));
    stats.lastLoginAt = row.occurred_at ? String(row.occurred_at) : null;
    stats.lastIp = row.ip ? String(row.ip) : null;
  }
  for (const row of week.rows) ensure(String(row.user_id)).distinctIps7 = Number(row.n ?? 0);
  for (const row of month.rows) ensure(String(row.user_id)).distinctIps30 = Number(row.n ?? 0);
  for (const row of failed.rows) ensure(String(row.user_id)).failedLogins7 = Number(row.n ?? 0);
  return map;
}

export type StoredLogin = {
  userId: string;
  at: string;
  ip: string | null;
  sessionId: string | null;
};

export async function recentSuccessfulLogins(sinceIso: string): Promise<StoredLogin[]> {
  await ensureSchema();
  const result = await getClient().execute({
    sql: `SELECT user_id, occurred_at, ip, session_id
      FROM login_events
      WHERE success = 1 AND user_id IS NOT NULL AND occurred_at >= ?`,
    args: [sinceIso],
  });
  return result.rows.map((row) => ({
    userId: String(row.user_id),
    at: String(row.occurred_at),
    ip: row.ip ? String(row.ip) : null,
    sessionId: row.session_id ? String(row.session_id) : null,
  }));
}

export type StoredSession = {
  id: string;
  userId: string;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string;
};

export async function recentSessions(sinceIso: string): Promise<StoredSession[]> {
  await ensureSchema();
  const result = await getClient().execute({
    sql: `SELECT id, user_id, ip, created_at, expires_at, revoked_at, last_seen_at
      FROM sessions
      WHERE created_at >= ? OR (revoked_at IS NULL AND expires_at >= ?)`,
    args: [sinceIso, sinceIso],
  });
  return result.rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    ip: row.ip ? String(row.ip) : null,
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    lastSeenAt: String(row.last_seen_at),
  }));
}

export async function listLoginHistory(userId: string, limit = 200): Promise<{ rows: LoginHistoryRow[]; total: number }> {
  await ensureSchema();
  const db = getClient();
  const count = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM login_events WHERE user_id = ? AND success = 1",
    args: [userId],
  });
  const result = await db.execute({
    sql: `SELECT id, occurred_at, ip, user_agent, fingerprint
      FROM login_events
      WHERE user_id = ? AND success = 1
      ORDER BY occurred_at DESC
      LIMIT ?`,
    args: [userId, limit],
  });
  return {
    total: Number(count.rows[0]?.n ?? 0),
    rows: result.rows.map((row) => ({
      id: String(row.id),
      occurredAt: String(row.occurred_at),
      ip: row.ip ? String(row.ip) : null,
      userAgent: row.user_agent ? String(row.user_agent) : null,
      fingerprint: row.fingerprint ? String(row.fingerprint) : null,
    })),
  };
}
