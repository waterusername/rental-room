import type { Tone } from "@/lib/format";

const tones: Record<Tone, string> = {
  ok: "border-accent-border bg-accent-soft text-accent",
  wait: "border-tan-border bg-tan-soft text-tan",
  alert: "border-warn-border bg-warn-soft text-warn",
  neutral: "border-line bg-panel-2 text-ink",
};

export function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
