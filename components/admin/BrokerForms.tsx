"use client";

import { useActionState } from "react";
import {
  createBrokerAction,
  createCheckoutLinkAction,
  forceLogoutAction,
  resetBrokerPasswordAction,
  setBrokerActiveAction,
  updateBrokerAction,
} from "@/lib/auth/admin-actions";
import { PasswordHint } from "@/components/auth/PasswordHint";
import { BILLING_LABEL, BILLING_STATUSES, type ActionState, type BillingStatus } from "@/lib/auth/types";

const inputClass = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm font-normal";
const primaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60";
const quietClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink disabled:opacity-60";
const warnClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-warn-border bg-warn-soft px-4 text-sm font-semibold text-warn disabled:opacity-60";

function Feedback({ state }: { state: ActionState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <div className="space-y-2">
      {state.error ? (
        <p role="alert" className="rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-sm text-warn">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-sm text-accent">{state.ok}</p>
      ) : null}
      {state.tempPassword ? (
        <p className="rounded-md border border-tan-border bg-tan-soft px-3 py-3 text-sm text-ink">
          Temporary password
          <span className="mt-1 block font-mono text-base font-semibold tracking-wide">{state.tempPassword}</span>
        </p>
      ) : null}
      {state.checkoutUrl ? (
        <label className="block text-sm font-semibold">
          Checkout link
          <input readOnly value={state.checkoutUrl} className={`${inputClass} font-mono text-xs`} onFocus={(event) => event.currentTarget.select()} />
        </label>
      ) : null}
    </div>
  );
}

export function CreateBrokerForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createBrokerAction, null);
  return (
    <form action={action} className="mt-6 max-w-xl space-y-4 rounded-lg border border-line bg-panel p-6 shadow-[var(--shadow)]">
      <Feedback state={state} />
      <label className="block text-sm font-semibold">
        Email
        <input name="email" type="email" required spellCheck={false} autoComplete="off" className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        Name <span className="font-normal text-muted">(optional)</span>
        <input name="name" type="text" autoComplete="off" className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        Company <span className="font-normal text-muted">(optional)</span>
        <input name="company" type="text" autoComplete="off" className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        Temporary password <span className="font-normal text-muted">(leave blank to generate one)</span>
        <input name="password" type="text" autoComplete="off" className={inputClass} />
        <PasswordHint />
      </label>
      <label className="block text-sm font-semibold">
        Billing
        <select name="billingStatus" defaultValue="payment_required" className={inputClass}>
          {BILLING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {BILLING_LABEL[status]}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm leading-6 text-muted">
        Outside brokers start as Payment required. Access is $100 USD per month once Stripe is configured. The Stripe
        Price (STRIPE_PRICE_ID) must be $100 USD billed monthly; this form does not set the dollar amount. A Grinberg
        office email is saved as a complimentary administrator and is not billed.
      </p>
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "Creating…" : "Create broker"}
      </button>
    </form>
  );
}

export function EditBrokerForm({
  userId,
  email,
  name,
  company,
  billingStatus,
  officeAccount = false,
}: {
  userId: string;
  email: string;
  name: string | null;
  company: string | null;
  billingStatus: BillingStatus;
  officeAccount?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateBrokerAction, null);
  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-panel p-5 shadow-[var(--shadow)]">
      <input type="hidden" name="userId" value={userId} />
      <h2 className="font-serif text-2xl font-semibold">Profile</h2>
      <Feedback state={state} />
      <label className="block text-sm font-semibold">
        Email
        <input name="email" type="email" required defaultValue={email} spellCheck={false} className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        Name
        <input name="name" type="text" defaultValue={name ?? ""} className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        Company
        <input name="company" type="text" defaultValue={company ?? ""} className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        Billing status
        {officeAccount ? (
          <input type="hidden" name="billingStatus" value="complimentary" />
        ) : null}
        <select
          name={officeAccount ? undefined : "billingStatus"}
          defaultValue={officeAccount ? "complimentary" : billingStatus}
          disabled={officeAccount}
          className={inputClass}
        >
          {BILLING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {BILLING_LABEL[status]}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm leading-6 text-muted">
        {officeAccount
          ? "This Grinberg office account stays complimentary and is not billed. Its email cannot be changed here."
          : "Set Payment required to keep this broker off the boards until Stripe marks the subscription paid. Complimentary and Paid can browse when Stripe is configured. Outside-broker access is $100 USD per month: STRIPE_PRICE_ID must be that monthly Price. Administrators can always browse."}
      </p>
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

export function BrokerSecurityForms({
  userId,
  active,
  self,
  stripeOn,
}: {
  userId: string;
  active: boolean;
  self: boolean;
  stripeOn: boolean;
}) {
  return (
    <div className="space-y-4">
      {self ? (
        <p className="rounded-lg border border-line bg-panel-2 px-4 py-3 text-sm text-muted">
          This is your administrator account. Change your password from Account. You cannot disable yourself here.
        </p>
      ) : (
        <>
          <SimpleAction
            action={setBrokerActiveAction}
            userId={userId}
            fields={{ active: active ? "0" : "1" }}
            label={active ? "Disable account" : "Enable account"}
            pendingLabel={active ? "Disabling…" : "Enabling…"}
            className={active ? warnClass : primaryClass}
            confirm={active ? "Disable this account and end its sessions?" : undefined}
          />
          <SimpleAction
            action={forceLogoutAction}
            userId={userId}
            label="Force logout"
            pendingLabel="Ending sessions…"
            className={quietClass}
            confirm="End every active session for this account?"
          />
          <SimpleAction
            action={resetBrokerPasswordAction}
            userId={userId}
            label="Reset password"
            pendingLabel="Resetting…"
            className={quietClass}
            confirm="Set a temporary password and end current sessions?"
          />
        </>
      )}
      {stripeOn && !self ? (
        <SimpleAction
          action={createCheckoutLinkAction}
          userId={userId}
          label="Generate Stripe checkout link"
          pendingLabel="Creating link…"
          className={quietClass}
        />
      ) : null}
      {stripeOn && !self ? (
        <p className="text-sm leading-6 text-muted">
          The checkout link charges the Stripe Price in STRIPE_PRICE_ID. That Price must be $100 USD, billed monthly.
          This desk does not set the dollar amount. Grinberg office accounts are not billed.
        </p>
      ) : null}
      {!stripeOn ? (
        <p className="text-sm leading-6 text-muted">
          Stripe is not configured, so billing status is stored but does not block the boards. When you add keys, set
          STRIPE_PRICE_ID to a $100 USD monthly Price.
        </p>
      ) : null}
    </div>
  );
}

function SimpleAction({
  action,
  userId,
  fields,
  label,
  pendingLabel,
  className,
  confirm,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  userId: string;
  fields?: Record<string, string>;
  label: string;
  pendingLabel: string;
  className: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, null);
  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-line bg-panel p-4"
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      {fields
        ? Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)
        : null}
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}
