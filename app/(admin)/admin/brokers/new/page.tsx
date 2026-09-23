import type { Metadata } from "next";
import Link from "next/link";
import { CreateBrokerForm } from "@/components/admin/BrokerForms";

export const metadata: Metadata = {
  title: "New broker",
  robots: { index: false, follow: false },
};

export default function NewBrokerPage() {
  return (
    <>
      <Link href="/admin" className="text-sm font-semibold text-accent">
        ← Broker access
      </Link>
      <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight">New broker</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
        The broker signs in with this email and temporary password, then must choose their own password. The temporary
        password is shown once and is not stored in a recoverable form.
      </p>
      <CreateBrokerForm />
    </>
  );
}
