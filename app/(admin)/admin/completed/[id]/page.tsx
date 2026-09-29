import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteCompletedRentalButton, EditCompletedRentalForm } from "@/components/admin/CompletedRentalForms";
import { findCompletedRental } from "@/lib/auth/db";
import { formatCompletedMoneyInput } from "@/lib/completed-rentals";

export const metadata: Metadata = {
  title: "Edit completed rental",
  robots: { index: false, follow: false },
};

export default async function EditCompletedRentalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rental = await findCompletedRental(id);
  if (!rental) notFound();

  return (
    <>
      <Link href="/admin/completed" className="text-sm font-semibold text-accent">
        ← Completed rentals
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-accent">Administrators only</p>
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight">{rental.property}</h1>
      <EditCompletedRentalForm
        values={{
          id: rental.id,
          property: rental.property,
          company: rental.company,
          notes: rental.notes,
          rentAmount: formatCompletedMoneyInput(rental.rentCents),
          feeToCollect: formatCompletedMoneyInput(rental.feeToCollectCents),
          otherAmount: formatCompletedMoneyInput(rental.otherAmountCents),
        }}
      />
      <div className="mt-4">
        <DeleteCompletedRentalButton id={rental.id} label="Remove this rental" />
      </div>
    </>
  );
}
