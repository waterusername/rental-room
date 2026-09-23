export default function ShareUnavailable() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold">This link is not available</h1>
      <p className="mt-3 max-w-xl text-muted">
        It may be expired, revoked, or incorrect. Ask the broker who sent it for a new link.
      </p>
    </div>
  );
}
