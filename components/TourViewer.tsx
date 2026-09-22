"use client";

import { useState } from "react";
import type { Tour } from "@/lib/types";

export function TourViewer({ tours, title }: { tours: Tour[]; title: string }) {
  const [active, setActive] = useState(0);
  const tour = tours[active] ?? tours[0];
  if (!tour) return null;
  const label = tour.label || `Tour ${active + 1}`;

  return (
    <div>
      {tours.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Matterport tours">
          {tours.map((item, index) => {
            const selected = index === active;
            return (
              <button
                key={`${item.url}-${index}`}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(index)}
                className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-panel text-ink"
                }`}
              >
                {item.label || `Tour ${index + 1}`}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-line bg-ink">
        <iframe
          src={tour.url}
          title={`${title} — ${label}`}
          className="aspect-video w-full"
          allow="fullscreen; xr-spatial-tracking"
        />
      </div>
      <p className="mt-3 text-sm">
        <a href={tour.url} target="_blank" rel="noreferrer" className="font-semibold text-accent">
          Open {label} in a new tab
        </a>
      </p>
    </div>
  );
}
