/**
 * The Tournament tab's outline while it loads, shown the moment its tab is
 * clicked (Next.js fetches it ahead of time for links on screen).
 */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Loading tournament teams…</span>
      <div className="space-y-2">
        <div className="h-6 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="h-11 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50" />
      <div className="flex gap-2">
        <div className="h-8 w-36 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-8 w-40 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-8 w-32 animate-pulse rounded-lg bg-neutral-100" />
      </div>
      <ol className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <li
            key={i}
            className="h-40 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50"
          />
        ))}
      </ol>
    </div>
  );
}
