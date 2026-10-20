"use client";

import dynamic from "next/dynamic";

/**
 * The builder, rendered in the browser only: its teams are saved there
 * (localStorage), which keeps the page the same for everyone so it can be
 * served from the CDN. Its game data loads with it, on this page only.
 */
export const BuilderLoader = dynamic(
  () => import("./builder").then((m) => m.Builder),
  { ssr: false, loading: () => <BuilderSkeleton /> },
);

/** The builder's outline while it loads. */
function BuilderSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Loading the builder…</span>
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-9 w-64 max-w-full animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-neutral-100" />
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50" />
    </div>
  );
}
