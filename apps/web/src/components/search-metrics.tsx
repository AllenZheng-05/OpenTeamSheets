import { count } from "@/lib/format";

/**
 * Figures about the teams a search matches, shown under the search bar.
 * For now, how many there are; usage and popularity of the matching teams
 * are meant to join it as more cards.
 */
export function SearchMetrics({ total }: { total: number | null }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-neutral-200 px-4 py-3">
        <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Results
        </dt>
        <dd className="mt-1 text-2xl font-semibold tabular-nums">
          {total === null ? (
            <span className="text-neutral-400">Counting…</span>
          ) : (
            count(total)
          )}
        </dd>
      </div>
    </dl>
  );
}
