import { loginAggregates, listLoginHistory, listUsers, recentSessions, recentSuccessfulLogins, toPublicUser } from "./db";
import { evaluateShareRisk, type ShareFlag } from "./share-risk";
import type { LoginHistoryRow, PublicUser } from "./types";
import { paymentsEnforced } from "./config";

export type AccountStats = {
  user: PublicUser;
  totalLogins: number;
  lastLoginAt: string | null;
  lastIp: string | null;
  distinctIps7: number;
  distinctIps30: number;
  failedLogins7: number;
  flags: ShareFlag[];
};

export type DashboardData = {
  brokers: AccountStats[];
  admins: AccountStats[];
  stripeOn: boolean;
};

export type BrokerDetail = AccountStats & {
  history: LoginHistoryRow[];
  historyTruncated: boolean;
};

const HISTORY_LIMIT = 200;

export async function loadDashboard(): Promise<DashboardData> {
  const stats = await buildStats();
  const brokers = stats.filter((item) => item.user.role === "broker").sort(sortAccounts);
  const admins = stats.filter((item) => item.user.role === "admin").sort(sortAccounts);
  return { brokers, admins, stripeOn: paymentsEnforced() };
}

export async function loadBrokerDetail(id: string): Promise<BrokerDetail | null> {
  const stats = await buildStats();
  const account = stats.find((item) => item.user.id === id);
  if (!account) return null;
  const history = await listLoginHistory(id, HISTORY_LIMIT);
  return {
    ...account,
    history: history.rows,
    historyTruncated: history.total > history.rows.length,
  };
}

async function buildStats(): Promise<AccountStats[]> {
  const now = Date.now();
  const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [users, aggregates, logins, sessions] = await Promise.all([
    listUsers(),
    loginAggregates(since7, since30),
    recentSuccessfulLogins(since30),
    recentSessions(since30),
  ]);

  const loginsByUser = groupBy(logins, (login) => login.userId);
  const sessionsByUser = groupBy(sessions, (session) => session.userId);
  const brokerIds = users.filter((user) => user.role === "broker").map((user) => user.id);

  return users.map((user) => {
    const aggregate = aggregates.get(user.id);
    const userLogins = loginsByUser.get(user.id) ?? [];
    const peerIds = user.role === "broker" ? brokerIds.filter((id) => id !== user.id) : [];
    const flags = evaluateShareRisk({
      now,
      logins: userLogins.map((login) => ({
        at: Date.parse(login.at),
        ip: login.ip,
        sessionId: login.sessionId,
      })),
      sessions: (sessionsByUser.get(user.id) ?? []).map((session) => ({
        id: session.id,
        ip: session.ip,
        createdAt: Date.parse(session.createdAt),
        expiresAt: Date.parse(session.expiresAt),
        revokedAt: session.revokedAt ? Date.parse(session.revokedAt) : null,
        lastSeenAt: Date.parse(session.lastSeenAt),
      })),
      peerDistinct7: peerIds.map((id) => aggregates.get(id)?.distinctIps7 ?? 0),
      peerDistinct30: peerIds.map((id) => aggregates.get(id)?.distinctIps30 ?? 0),
    });
    return {
      user: toPublicUser(user),
      totalLogins: aggregate?.totalLogins ?? 0,
      lastLoginAt: aggregate?.lastLoginAt ?? null,
      lastIp: aggregate?.lastIp ?? null,
      distinctIps7: aggregate?.distinctIps7 ?? 0,
      distinctIps30: aggregate?.distinctIps30 ?? 0,
      failedLogins7: aggregate?.failedLogins7 ?? 0,
      flags,
    };
  });
}

function sortAccounts(a: AccountStats, b: AccountStats): number {
  if (a.flags.length !== b.flags.length) return b.flags.length - a.flags.length;
  const aTime = a.lastLoginAt ? Date.parse(a.lastLoginAt) : 0;
  const bTime = b.lastLoginAt ? Date.parse(b.lastLoginAt) : 0;
  if (aTime !== bTime) return bTime - aTime;
  return a.user.email.localeCompare(b.user.email);
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    const list = map.get(id);
    if (list) list.push(item);
    else map.set(id, [item]);
  }
  return map;
}
