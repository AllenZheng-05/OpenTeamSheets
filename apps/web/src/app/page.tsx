import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getCurrentRegulation } from "@ots/core";
import { getRegulationDataStatus } from "@ots/core/game-data";
import { RegulationCountdown } from "@/components/regulation-countdown";
import {
  SearchPendingProvider,
  SearchResultsFade,
} from "@/components/search-pending";
import { readPage, SearchResults } from "@/components/search-results";
import { TeamSearch } from "@/components/team-search";
import { fillBoxInUrl } from "@/lib/box-server";
import { hasFilters, readFilters } from "@/lib/search";
import { searchBarProps } from "@/lib/search-options";

/**
 * The home page: one search across every team. With nothing chosen it's
 * just the bar; results appear below once a filter is.
 *
 * Every team is a tournament team for now. When community teams arrive,
 * results here become one row per team, with its placement or its author.
 */
export default async function Home({ searchParams }: PageProps<"/">) {
  // Render on each request, so the regulation is right the moment it changes.
  await connection();
  const params = await searchParams;
  const page = readPage(params.page);
  if (page === null) notFound();
  const regulation = getCurrentRegulation();
  const rulesPending = getRegulationDataStatus(regulation) !== "complete";
  const filters = readFilters(params, regulation);
  await fillBoxInUrl("/", filters, regulation, page);
  const searching = hasFilters(filters, regulation);

  return (
    <SearchPendingProvider>
      <div className="space-y-6">
        <div
          className={`flex flex-col items-center text-center ${searching ? "pt-2" : "pt-16 sm:pt-24"}`}
        >
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Open Team Sheets
          </h1>
          <p className="mt-2 text-neutral-500">
            Find, build and share Pokémon Champions VGC teams.
          </p>
          <div className="mt-8 w-full max-w-3xl">
            <TeamSearch
              path="/"
              filters={filters}
              current={regulation}
              size="lg"
              {...await searchBarProps(filters)}
            />
          </div>
          {!searching && (
            <div className="mt-10 space-y-1 text-sm text-neutral-500">
              <p>
                Current format:{" "}
                <span className="text-neutral-900">
                  Regulation {regulation}
                </span>
                {rulesPending && " · rules still being added"}
              </p>
              <RegulationCountdown />
            </div>
          )}
        </div>

        {searching && (
          <SearchResultsFade>
            <SearchResults
              path="/"
              filters={filters}
              current={regulation}
              page={page}
            />
          </SearchResultsFade>
        )}
      </div>
    </SearchPendingProvider>
  );
}
