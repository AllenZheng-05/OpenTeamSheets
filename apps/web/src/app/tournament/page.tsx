import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentRegulation } from "@ots/core";
import { readPage, SearchResults } from "@/components/search-results";
import { TeamSearch } from "@/components/team-search";
import { readFilters } from "@/lib/search";
import { searchBarProps } from "@/lib/search-options";

export const metadata: Metadata = { title: "Tournament teams" };

/** Every team played at official tournaments, searchable, newest first. */
export default async function TournamentTeams({
  searchParams,
}: PageProps<"/tournament">) {
  const params = await searchParams;
  const page = readPage(params.page);
  if (page === null) notFound();
  const current = getCurrentRegulation();
  const filters = readFilters(params, current);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Tournament teams
        </h1>
        <p className="text-sm text-neutral-500">
          Teams from official tournaments and large online ones (64+ players),
          newest first.
        </p>
      </header>

      <TeamSearch
        path="/tournament"
        filters={filters}
        current={current}
        {...await searchBarProps()}
      />

      <SearchResults
        path="/tournament"
        filters={filters}
        current={current}
        page={page}
      />
    </div>
  );
}
