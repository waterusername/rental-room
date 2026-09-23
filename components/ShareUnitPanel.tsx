"use client";

import { useActionState, useRef, useState } from "react";
import { createUnitShareAction } from "@/lib/auth/share-actions";
import type { ActionState } from "@/lib/auth/types";

const inputClass = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 font-mono text-xs font-normal";

export function ShareUnitPanel({ unitId, unitTitle }: { unitId: string; unitTitle: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createUnitShareAction, null);

  return (
    <aside className="mt-6 rounded-lg border border-tan-border bg-tan-soft px-4 py-4" aria-label="Share this unit">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-tan">Share this unit</h2>
      <p className="mt-2 text-sm leading-6 text-ink">
        Create a link for a prospect. Anyone with the link can open {unitTitle} without signing in. It does not open
        the vacancy boards, other units, the access desk, or account pages. The link expires 1 day after you create
        it.
      </p>
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
