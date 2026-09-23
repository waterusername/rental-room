"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createUnitShareAction, revokeUnitShareAction } from "@/lib/auth/share-actions";
import type { ActionState } from "@/lib/auth/types";

export type ShareLinkRow = {
  id: string;
  createdLabel: string;
  expiresLabel: string;
  viewCount: number;
  createdByEmail: string;
};

const inputClass = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 font-mono text-xs font-normal";

export function ShareUnitPanel({
  unitId,
  unitTitle,
  ttlDays,
  links,
  showCreator,
  loadError,
}: {
  unitId: string;
  unitTitle: string;
  ttlDays: number;
  links: ShareLinkRow[];
  showCreator: boolean;
  loadError?: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createUnitShareAction, null);

  return (
    <aside className="mt-6 rounded-lg border border-tan-border bg-tan-soft px-4 py-4" aria-label="Share this unit">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-tan">Share this unit</h2>
      <p className="mt-2 text-sm leading-6 text-ink">
        Create a link for a prospect. Anyone with the link can open {unitTitle} without signing in. It does not open
        the vacancy boards, other units, the access desk, or account pages. The link expires {ttlDays} days after you
        create it. Revoke stops it immediately.
      </p>
      {loadError ? (
        <p role="alert" className="mt-3 rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
          {loadError}
        </p>
      ) : null}
      <form action={action} className="mt-4">
        <input type="hidden" name="unitId" value={unitId} />
        {state?.error ? (
          <p role="alert" className="mb-3 rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="mb-3 rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-sm text-accent">{state.ok}</p>
        ) : null}
        {state?.shareUrl ? <CopyShareLink url={state.shareUrl} /> : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create share link"}
        </button>
      </form>
      {links.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {links.map((link) => (
            <li key={link.id} className="rounded-md border border-tan-border bg-panel px-3 py-3 text-sm">
              <p>Created {link.createdLabel}</p>
              <p className="mt-1">Expires {link.expiresLabel}</p>
              <p className="mt-1 text-muted">
                {link.viewCount} {link.viewCount === 1 ? "view" : "views"}
              </p>
              {showCreator ? <p className="mt-1">Created by {link.createdByEmail}</p> : null}
              <form action={revokeUnitShareAction} className="mt-2">
                <input type="hidden" name="shareId" value={link.id} />
                <input type="hidden" name="unitId" value={unitId} />
                <RevokeButton />
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No active link for this unit.</p>
      )}
    </aside>
  );
}

function CopyShareLink({ url }: { url: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setCopied(false);
    }
  }

  return (
    <div>
      <label className="block text-sm font-semibold">
        Share link
        <input
          ref={inputRef}
          readOnly
          value={url}
          className={inputClass}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <button
        type="button"
        onClick={onCopy}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink"
      >
        {copied ? "Copied" : "Copy share link"}
      </button>
    </div>
  );
}

function RevokeButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-warn-border bg-warn-soft px-4 text-sm font-semibold text-warn disabled:opacity-60"
    >
      {pending ? "Revoking…" : "Revoke"}
    </button>
  );
}
