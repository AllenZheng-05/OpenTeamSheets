import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import type { Regulation } from "@ots/core";
import { decodeBoxBits } from "@ots/core/teams";
import { filtersHref, hasFilters, type Filters } from "@/lib/search";
import { cachedCount, cachedSearch, PAGE_SIZE, searchKey } from "@/lib/teams";
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
  // The box matched is in the URL, so the results are the same for anyone
  // with this URL and can be cached.
  const owned =
    filters.box !== null
      ? (decodeBoxBits(filters.have ?? "") ?? new Set<string>())
      : null;
  // An empty box can't build a team (teams have at least four Pokémon), so
  // there's nothing to ask the database.
  const { rows, hasNext } =
    owned?.size === 0
      ? { rows: [], hasNext: false }
      : await cachedSearch(filters, page - 1);
  if (rows.length === 0 && page > 1) notFound();

  if (rows.length === 0) {
    const empty =
      owned && owned.size === 0 ? (
        <EmptyState>
          Your box is empty, so there are no teams you can build yet.{" "}
          <Link
            href="/box"
            className="text-neutral-900 underline underline-offset-2"
          >
            Set up your box
          </Link>
        </EmptyState>
      ) : hasFilters(filters, current) ? (
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

  // The rows show straight away; the total (for the Results card and the
  // page numbers) streams in once it's counted.
  const key = await searchKey(filters);
  const pagination = (total: number | null) => (
    <Pagination
      page={page}
      pageSize={PAGE_SIZE}
      total={total}
      rowsShown={rows.length}
      hasNext={hasNext}
      href={(n) => filtersHref(path, filters, current, n)}
    />
  );
  return (
    <>
      <Suspense fallback={<SearchMetrics total={null} />}>
        <Counted counting={cachedCount(key, filters)}>
          {(total) => <SearchMetrics total={total} />}
        </Counted>
      </Suspense>
      <ol className="space-y-3">
        {rows.map((row) => (
          <li key={row.id}>
            <TeamRow row={row} owned={owned} />
          </li>
        ))}
      </ol>
      <Suspense fallback={pagination(null)}>
        <Counted counting={cachedCount(key, filters)}>{pagination}</Counted>
      </Suspense>
    </>
  );
}

/** The page number from search params, or null if it isn't one. */
export function readPage(value: string | string[] | undefined): number | null {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page >= 1 ? page : null;
}

/** Renders its children with the total once it's counted. */
async function Counted({
  counting,
  children,
}: {
  counting: Promise<number>;
  children: (total: number) => ReactNode;
}) {
  return children(await counting);
}
