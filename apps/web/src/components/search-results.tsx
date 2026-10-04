import Link from "next/link";
import { notFound } from "next/navigation";
import type { Regulation } from "@ots/core";
import { filtersHref, hasFilters, type Filters } from "@/lib/search";
import { PAGE_SIZE, searchPlacements } from "@/lib/teams";
import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { SearchMetrics } from "./search-metrics";
import { TeamRow } from "./team-row";

/**
 * Figures about a search, then one page of the teams matching it, with page
 * numbers. A page past the end is a 404.
 */
export async function SearchResults({
  path,
  filters,
  current,
  page,
}: {
  path: string;
  filters: Filters;
  current: Regulation;
  /** From 1. */
  page: number;
}) {
  const { rows, total } = await searchPlacements(filters, page - 1);
  if (rows.length === 0 && page > 1) notFound();

  if (rows.length === 0) {
    const empty = hasFilters(filters, current) ? (
      <EmptyState>
        No teams match these filters.{" "}
        <Link
          href={path}
          className="text-neutral-900 underline underline-offset-2"
        >
          Clear filters
        </Link>
      </EmptyState>
    ) : (
      <EmptyState>
        No tournament teams yet. Official results will appear here once
        they&apos;re imported.
      </EmptyState>
    );
    return (
      <>
        <SearchMetrics total={0} />
        {empty}
      </>
    );
  }

  return (
    <>
      <SearchMetrics total={total} />
      <ol className="space-y-3">
        {rows.map((row) => (
          <li key={row.id}>
            <TeamRow row={row} />
          </li>
        ))}
      </ol>
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        href={(n) => filtersHref(path, filters, current, n)}
      />
    </>
  );
}

/** The page number from search params, or null if it isn't one. */
export function readPage(value: string | string[] | undefined): number | null {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page >= 1 ? page : null;
}
