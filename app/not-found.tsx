import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold">That unit is not on the sheet</h1>
      <p className="mt-3 max-w-xl text-muted">
        The rental room only lists units in the current vacancy file.
      </p>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center font-semibold text-accent">
        Back to apartments
      </Link>
    </div>
  );
}
