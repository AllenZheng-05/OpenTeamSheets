import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentRegulation } from "@ots/core";
import {
  SearchPendingProvider,
  SearchResultsFade,
} from "@/components/search-pending";
import { readPage, SearchResults } from "@/components/search-results";
import { TeamSearch } from "@/components/team-search";
import { fillBoxInUrl } from "@/lib/box-server";
import { readFilters } from "@/lib/search";
import { searchBarProps } from "@/lib/search-options";

export const metadata: Metadata = { title: "Tournament teams" };

/** Every team played at official tournaments. */
export default async function TournamentTeams({
  searchParams,
}: PageProps<"/tournament">) {
  const params = await searchParams;
  const page = readPage(params.page);
  if (page === null) notFound();
  const current = getCurrentRegulation();
  const filters = readFilters(params, current);
  await fillBoxInUrl("/tournament", filters, current, page);

  return (
    <SearchPendingProvider>
      <div className="space-y-5">
        <TeamSearch
          path="/tournament"
          filters={filters}
          current={current}
          {...await searchBarProps(filters)}
        />

        <SearchResultsFade>
          <SearchResults
            path="/tournament"
            filters={filters}
            current={current}
            page={page}
          />
        </SearchResultsFade>
      </div>
    </SearchPendingProvider>
  );
}
