export function ShareClosed({ reason }: { reason: "expired" | "revoked" }) {
  const expired = reason === "expired";
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold">{expired ? "This link has expired" : "This link has been revoked"}</h1>
      <p className="mt-3 max-w-xl text-muted">
        It no longer opens the unit. Ask the broker who sent it for a new link.
      </p>
    </div>
  );
}
