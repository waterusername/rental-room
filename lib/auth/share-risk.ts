/**
 * Share-risk rules. The admin desk and README describe these same thresholds.
 *
 * 1. rapid_ip_switch — In the last 7 days, a successful sign-in used a different
 *    IP from another successful sign-in inside the previous 2 hours, and some
 *    earlier session was still active (not revoked, not expired).
 * 2. concurrent_sessions — Two sessions with different IPs were both active,
 *    and both were seen within 2 hours of each other during the last 7 days.
 * 3. different_networks — A case from (1) or (2) happened inside 30 minutes and
 *    the IPs sit on different network prefixes (IPv4 /16 or IPv6 first two
 *    groups). This is not a map or city lookup.
 * 4. high_ips_7d — Distinct IPs in 7 days reach at least 4, and at least twice
 *    the median of other brokers when two or more other brokers exist.
 * 5. high_ips_30d — Distinct IPs in 30 days reach at least 8, with the same
 *    peer rule. Administrators are compared to the absolute floors only.
 */

export const SHARE_WINDOWS = {
  rapidMs: 2 * 60 * 60 * 1000,
  concurrentMs: 2 * 60 * 60 * 1000,
  networkMs: 30 * 60 * 1000,
  recentMs: 7 * 24 * 60 * 60 * 1000,
  monthMs: 30 * 24 * 60 * 60 * 1000,
  minDistinct7: 4,
  minDistinct30: 8,
  peerMultiplier: 2,
  minPeers: 2,
} as const;

export type ShareFlagCode =
  | "rapid_ip_switch"
  | "concurrent_sessions"
  | "different_networks"
  | "high_ips_7d"
  | "high_ips_30d";

export type ShareFlag = {
  code: ShareFlagCode;
  summary: string;
};

export const SHARE_RULES: { code: ShareFlagCode; title: string; detail: string }[] = [
  {
    code: "rapid_ip_switch",
    title: "New IP while another session is still active",
    detail:
      "Within the last 7 days the account signed in from two or more IP addresses inside a 2-hour window, and an earlier session was still active (not signed out and not expired).",
  },
  {
    code: "concurrent_sessions",
    title: "Overlapping sessions from different IPs",
    detail:
      "Two sessions were active at the same time from different IP addresses, and both showed activity within 2 hours, sometime in the last 7 days.",
  },
  {
    code: "different_networks",
    title: "Those sessions used very different networks",
    detail:
      "Overlapping use happened within 30 minutes and the IP addresses do not share a network prefix (the first two numbers of an IPv4 address, or the first two groups of an IPv6 address). This is a network comparison, not a city or map lookup.",
  },
  {
    code: "high_ips_7d",
    title: "Many IPs in 7 days",
    detail:
      "Distinct IP addresses in the last 7 days are at least 4, and at least twice the median of other brokers when two or more other brokers exist. Administrators are held to the absolute floor of 4.",
  },
  {
    code: "high_ips_30d",
    title: "Many IPs in 30 days",
    detail:
      "Distinct IP addresses in the last 30 days are at least 8, and at least twice the median of other brokers when two or more other brokers exist. Administrators are held to the absolute floor of 8.",
  },
];

export type LoginPoint = {
  at: number;
  ip: string | null;
  sessionId: string | null;
};

export type SessionPoint = {
  id: string;
  ip: string | null;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
  lastSeenAt: number;
};

function usableIp(ip: string | null | undefined): ip is string {
  return Boolean(ip && ip !== "unknown");
}

export function networkPrefix(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").filter((part) => part.length > 0);
    return parts.slice(0, 2).join(":") || trimmed;
  }
  const parts = trimmed.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}`;
  return trimmed;
}

export function distinctIps(logins: LoginPoint[], since: number): string[] {
  const ips = new Set<string>();
  for (const login of logins) {
    if (login.at < since || !usableIp(login.ip)) continue;
    ips.add(login.ip);
  }
  return [...ips];
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function peerThreshold(peerCounts: number[], floor: number): number {
  if (peerCounts.length < SHARE_WINDOWS.minPeers) return floor;
  return Math.max(floor, median(peerCounts) * SHARE_WINDOWS.peerMultiplier);
}

function formatUtc(ms: number): string {
  const stamp = new Date(ms).toISOString();
  return `${stamp.slice(0, 10)} ${stamp.slice(11, 16)} UTC`;
}

function sessionActiveAt(session: SessionPoint, at: number): boolean {
  return session.createdAt <= at && session.expiresAt > at && (session.revokedAt == null || session.revokedAt > at);
}

export function evaluateShareRisk(args: {
  logins: LoginPoint[];
  sessions: SessionPoint[];
  peerDistinct7: number[];
  peerDistinct30: number[];
  now?: number;
}): ShareFlag[] {
  const now = args.now ?? Date.now();
  const recentSince = now - SHARE_WINDOWS.recentMs;
  const monthSince = now - SHARE_WINDOWS.monthMs;
  const flags: ShareFlag[] = [];

  const recentLogins = args.logins
    .filter((login) => login.at >= recentSince && login.at <= now && usableIp(login.ip))
    .sort((a, b) => a.at - b.at);

  let rapid: { at: number; ips: string[] } | null = null;
  let rapidNetwork: { at: number; ips: string[] } | null = null;

  for (const login of recentLogins) {
    const window = recentLogins.filter(
      (item) => item.at >= login.at - SHARE_WINDOWS.rapidMs && item.at <= login.at,
    );
    const ips = [...new Set(window.map((item) => item.ip as string))];
    if (ips.length < 2) continue;
    const previousStillActive = args.sessions.some((session) => {
      if (!sessionActiveAt(session, login.at)) return false;
      if (!usableIp(session.ip) || session.ip === login.ip) return false;
      if (login.sessionId && session.id === login.sessionId) return false;
      return session.createdAt < login.at;
    });
    if (!previousStillActive) continue;
    if (!rapid || login.at > rapid.at) rapid = { at: login.at, ips };

    const halfHour = recentLogins.filter(
      (item) => item.at >= login.at - SHARE_WINDOWS.networkMs && item.at <= login.at,
    );
    const closeIps = [...new Set(halfHour.map((item) => item.ip as string))];
    const prefixes = new Set(closeIps.map((ip) => networkPrefix(ip)));
    if (closeIps.length >= 2 && prefixes.size >= 2 && (!rapidNetwork || login.at > rapidNetwork.at)) {
      rapidNetwork = { at: login.at, ips: closeIps };
    }
  }

  if (rapid) {
    flags.push({
      code: "rapid_ip_switch",
      summary: `Signed in from ${rapid.ips.length} IP addresses within 2 hours while an earlier session was still active (${rapid.ips.join(", ")}). Latest ${formatUtc(rapid.at)}.`,
    });
  }

  const sessions = args.sessions.filter((session) => usableIp(session.ip));
  let concurrent: { at: number; ips: string[] } | null = null;
  let network: { at: number; ips: string[] } | null = null;

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const left = sessions[i]!;
      const right = sessions[j]!;
      if (left.ip === right.ip) continue;
      const leftStop = left.revokedAt ?? left.expiresAt;
      const rightStop = right.revokedAt ?? right.expiresAt;
      const overlapStart = Math.max(left.createdAt, right.createdAt);
      const overlapEnd = Math.min(leftStop, rightStop);
      if (overlapEnd <= overlapStart || overlapEnd < recentSince) continue;
      const seenGap = Math.abs(left.lastSeenAt - right.lastSeenAt);
      if (seenGap > SHARE_WINDOWS.concurrentMs) continue;
      const laterSeen = Math.max(left.lastSeenAt, right.lastSeenAt);
      if (laterSeen < recentSince || laterSeen > now) continue;
      const ips = [left.ip as string, right.ip as string];
      if (!concurrent || laterSeen > concurrent.at) concurrent = { at: laterSeen, ips };
      if (
        seenGap <= SHARE_WINDOWS.networkMs &&
        networkPrefix(left.ip as string) !== networkPrefix(right.ip as string) &&
        (!network || laterSeen > network.at)
      ) {
        network = { at: laterSeen, ips };
      }
    }
  }

  if (concurrent) {
    flags.push({
      code: "concurrent_sessions",
      summary: `Two sessions were active together from different IP addresses (${concurrent.ips.join(", ")}), with activity within 2 hours. Latest activity ${formatUtc(concurrent.at)}.`,
    });
  }

  const networkHit = network ?? rapidNetwork;
  if (networkHit) {
    flags.push({
      code: "different_networks",
      summary: `Overlapping sessions came from different networks (${networkHit.ips.join(", ")}) within 30 minutes. Compared by IP prefix, not a map lookup. Latest ${formatUtc(networkHit.at)}.`,
    });
  }

  const ips7 = distinctIps(args.logins, recentSince);
  const ips30 = distinctIps(args.logins, monthSince);
  const threshold7 = peerThreshold(args.peerDistinct7, SHARE_WINDOWS.minDistinct7);
  const threshold30 = peerThreshold(args.peerDistinct30, SHARE_WINDOWS.minDistinct30);

  if (ips7.length >= threshold7) {
    flags.push({
      code: "high_ips_7d",
      summary: `${ips7.length} distinct IP addresses in the last 7 days. Flag threshold is ${threshold7}.`,
    });
  }
  if (ips30.length >= threshold30) {
    flags.push({
      code: "high_ips_30d",
      summary: `${ips30.length} distinct IP addresses in the last 30 days. Flag threshold is ${threshold30}.`,
    });
  }

  return flags;
}
