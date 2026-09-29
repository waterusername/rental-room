import { GRINBERG_ADMIN_EMAILS } from "./auth/config.ts";
import { claimEmailText } from "./claim-record.ts";

/** Always notified, even when OFFICE_NOTIFY_EMAILS replaces the office list. */
export const DANIEL_OFFICE_EMAIL = "daniel@grinbergmanagement.com";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ClaimNotice = {
  brokerName: string | null;
  brokerEmail: string;
  unitAddress: string;
  unitLabel: string;
  unitId: string;
  claimedAt: string;
  note: string;
};

export type NotifyResult = {
  status: "sent" | "not_configured" | "failed";
  recipients: string[];
  detail: string;
};

/**
 * OFFICE_NOTIFY_EMAILS, when set, replaces GRINBERG_ADMIN_EMAILS.
 * daniel@grinbergmanagement.com is always included.
 */
export function officeNotifyRecipients(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.OFFICE_NOTIFY_EMAILS ?? "")
    .split(/[,;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
  const source = configured.length > 0 ? configured : [...GRINBERG_ADMIN_EMAILS];
  const recipients: string[] = [];
  const seen = new Set<string>();
  for (const email of [...source, DANIEL_OFFICE_EMAIL]) {
    if (!EMAIL.test(email) || seen.has(email)) continue;
    seen.add(email);
    recipients.push(email);
  }
  return recipients;
}

function clip(value: string, max = 300): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

/**
 * TODO: Set RESEND_API_KEY and MAIL_FROM before this sends mail.
 * Until both are set, the claim is still stored and notify_status is "not_configured".
 * This app does not store SMTP credentials.
 */
export async function notifyOfficeOfClaim(
  notice: ClaimNotice,
  options?: {
    fetchImpl?: typeof fetch;
    env?: NodeJS.ProcessEnv;
  },
): Promise<NotifyResult> {
  const env = options?.env ?? process.env;
  const recipients = officeNotifyRecipients(env);
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const from = env.MAIL_FROM?.trim() ?? "";
  const recipientList = recipients.join(", ");
  if (!apiKey || !from) {
    return {
      status: "not_configured",
      recipients,
      detail: clip(
        `Set RESEND_API_KEY and MAIL_FROM to email the office. Would notify ${recipientList}. The claim is saved.`,
      ),
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  const subject = `Reserved: ${notice.unitAddress}, ${notice.unitLabel}`;
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        text: claimEmailText(notice),
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return {
        status: "failed",
        recipients,
        detail: clip(`Resend ${response.status}: ${body}`),
      };
    }
    return {
      status: "sent",
      recipients,
      detail: clip(`Sent via Resend to ${recipientList}.`),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email failed";
    return {
      status: "failed",
      recipients,
      detail: clip(message),
    };
  }
}
