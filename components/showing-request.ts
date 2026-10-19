import { datetimeLocalToIso } from "@/lib/showings";

export type ShowingFormValues = {
  shownAtLocal: string;
  prospectFirstName: string;
  outcome: string;
  note: string;
};

export function showingWriteBody(
  values: ShowingFormValues,
): { ok: true; body: { shownAt: string; prospectFirstName: string; outcome: string; note: string } } | { ok: false; error: string } {
  const shownAt = datetimeLocalToIso(values.shownAtLocal);
  if (!shownAt) return { ok: false, error: "Enter a valid date and time." };
  return {
    ok: true,
    body: {
      shownAt,
      prospectFirstName: values.prospectFirstName,
      outcome: values.outcome,
      note: values.note,
    },
  };
}

export async function sendShowing(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<string | null> {
  const response = await fetch(path, {
    method,
    headers:
      body === undefined
        ? { accept: "application/json" }
        : { accept: "application/json", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.ok) return null;
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    // The status is enough when the body is empty.
  }
  return method === "DELETE" ? "Could not delete the showing." : "Could not save the showing.";
}
