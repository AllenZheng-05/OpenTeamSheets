/**
 * The box page's outline while it loads, shown the moment its tab is
 * clicked (Next.js fetches it ahead of time for links on screen).
 */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Loading your box…</span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-8 w-64 max-w-full animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-8 w-28 animate-pulse rounded-lg bg-neutral-100" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-neutral-100" />
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5">
        {Array.from({ length: 48 }, (_, i) => (
          <li
            key={i}
            className="h-24 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50"
          />
        ))}
      </ul>
    </div>
  );
}
