import { unstable_cache } from "next/cache";
import { cache } from "react";
import { isRegulation, type Regulation } from "@ots/core";
import {
  describeSheetError,
  exportShowdown,
  sheetErrors,
  type Team,
} from "@ots/core/teams";
import type { Json } from "@ots/core/db";
import { dateRange } from "./format";
import { pokemonView, setFromRow, type PokemonView } from "./pokemon";
import { setDetails } from "./pokemon-details";
import { rpcFilters, type Filters } from "./search";
import { supabase } from "./supabase";

export const PAGE_SIZE = 25;

export interface Archetype {
  id: string;
  name: string;
}

export interface EventSummary {
  slug: string;
  name: string;
  /** An official Play! Pokémon event, rather than an online one. */
  official: boolean;
  dates: string;
  regulation: string;
  playerCount: number | null;
  standingsUrl: string | null;
}

/** One tournament placement, as a row in the Tournament tab. */
export interface PlacementRow {
  id: string;
  teamId: string;
  player: string;
  placement: number | null;
  /** "15-2", when known. */
  record: string | null;
  /** The furthest the player went, for the row's badge. */
  stage: "top-cut" | "day-2" | null;
  event: EventSummary;
  archetypes: Archetype[];
  pokemon: PokemonView[];
  /** Whether the team sheet, as published, has errors. */
  hasSheetErrors: boolean;
  /** How many results match the search (players who used the team). */
  uses: number;
  /** How many of those made top cut, and day 2. */
  topCuts: number;
  dayTwos: number;
  /** How many of those reached the best placement shown. */
  bestCount: number;
}

interface TeamDetails {
  team: Team;
  pokemon: PokemonView[];
  archetypes: Archetype[];
  showdown: string;
  /**
   * What's wrong with the team sheet as published, such as "Slot 5:
   * Basculegion can't learn Last Resort (probably Last Respects)".
   * Official sheets are stored as published, typos included.
   */
  sheetErrors: string[];
}

/** Throws a Supabase error so the page shows its error state. */
function check<T>(result: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/**
 * Sets, archetypes and sheet errors for teams, keyed by team id. Takes
 * each team's regulation, which its sheet is checked against.
 */
async function loadTeams(
  regulations: Map<string, Regulation>,
): Promise<Map<string, TeamDetails>> {
  const ids = [...regulations.keys()];
  if (ids.length === 0) return new Map();
  const [sets, tags] = await Promise.all([
    supabase().from("team_sets").select("*").in("team_id", ids).order("slot"),
    supabase()
      .from("team_archetypes")
      .select("team_id, archetypes (id, name)")
      .in("team_id", ids),
  ]);

  const details = new Map<string, TeamDetails>();
  for (const id of ids) {
    const rows = check(sets).filter((row) => row.team_id === id);
    const team: Team = { sets: rows.map(setFromRow) };
    const errors = sheetErrors(team, regulations.get(id)!);
    details.set(id, {
      team,
      pokemon: team.sets.map((set, i) =>
        pokemonView(
          set,
          rows[i]!.slot,
          errors.filter((e) => e.slot === i + 1),
        ),
      ),
      archetypes: check(tags)
        .filter((tag) => tag.team_id === id && tag.archetypes)
        .map((tag) => tag.archetypes!),
      showdown: exportShowdown(team),
      sheetErrors: errors.map(describeSheetError),
    });
  }
  return details;
}

type PlacementRecord = {
  id: string | null;
  team_id: string | null;
  player_name: string | null;
  placement: number | null;
  wins: number | null;
  losses: number | null;
  made_day_two: boolean | null;
  made_top_cut: boolean | null;
  teamlist_url: string | null;
  event_slug: string | null;
  event_name: string | null;
  official: boolean | null;
  regulation_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  player_count: number | null;
  standings_url: string | null;
};

const eventSummary = (row: PlacementRecord): EventSummary => ({
  slug: row.event_slug ?? "",
  name: row.event_name ?? "",
  official: row.official ?? true,
  dates:
    row.starts_on && row.ends_on ? dateRange(row.starts_on, row.ends_on) : "",
  regulation: row.regulation_id ?? "",
  playerCount: row.player_count,
  standingsUrl: row.standings_url,
});

const record = (row: PlacementRecord) =>
  row.wins !== null && row.losses !== null ? `${row.wins}-${row.losses}` : null;

const stage = (row: PlacementRecord) =>
  row.made_top_cut ? "top-cut" : row.made_day_two ? "day-2" : null;

/**
 * A page of teams matching a search, one row per team with its best
 * matching result (official before online), and whether there's a page
 * after it. Counting every team is separate (countTeams), so the page
 * needn't wait for it.
 */
export async function searchTeams(
  filters: Filters,
  page: number,
): Promise<{ rows: PlacementRow[]; hasNext: boolean }> {
  const from = page * PAGE_SIZE;
  // One more than a page, to know whether another follows.
  // The function pages itself, so only this page's teams get their best
  // result looked up.
  const { data, error } = await supabase().rpc("search_teams", {
    filters: rpcFilters(filters) as unknown as Json,
    sort: filters.sort,
    page_offset: from,
    page_limit: PAGE_SIZE + 1,
  });
  if (error) throw new Error(error.message);
  const hasNext = (data?.length ?? 0) > PAGE_SIZE;
  const records = (data ?? []).slice(0, PAGE_SIZE);
  const teams = await loadTeams(
    new Map(
      records.flatMap((r): [string, Regulation][] =>
        isRegulation(r.regulation_id) ? [[r.team_id, r.regulation_id]] : [],
      ),
    ),
  );

  return {
    // Every team has a regulation; one without would be skipped, not shown.
    rows: records
      .filter((row) => teams.has(row.team_id))
      .map((row) => {
        const details = teams.get(row.team_id)!;
        const best = { ...row, id: row.best_id };
        return {
          id: row.team_id,
          teamId: row.team_id,
          player: row.player_name,
          placement: row.placement,
          record: record(best),
          stage: stage(best),
          event: eventSummary(best),
          archetypes: details.archetypes,
          pokemon: details.pokemon,
          hasSheetErrors: details.sheetErrors.length > 0,
          uses: row.uses,
          topCuts: row.top_cuts,
          dayTwos: row.day_twos,
          bestCount: row.best_count,
        };
      }),
    hasNext,
  };
}

/** How many teams match a search. */
export async function countTeams(filters: Filters): Promise<number> {
  const { data, error } = await supabase().rpc("count_teams", {
    filters: rpcFilters(filters) as unknown as Json,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

export interface TeamPage extends TeamDetails {
  id: string;
  regulation: Regulation;
  placements: (Omit<
    PlacementRow,
    | "pokemon"
    | "archetypes"
    | "teamId"
    | "hasSheetErrors"
    | "uses"
    | "topCuts"
    | "dayTwos"
    | "bestCount"
  > & {
    teamlistUrl: string | null;
  })[];
  media: {
    kind: string;
    url: string;
    startSeconds: number | null;
    title: string | null;
  }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A public team as a Showdown paste, for Copy team on a search result, or
 * null if there's none. Rows fetch it on click rather than carrying it.
 */
export async function teamShowdown(id: string): Promise<string | null> {
  if (!UUID.test(id)) return null;
  const { data: team, error } = await supabase()
    .from("teams")
    .select("regulation_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!team || !isRegulation(team.regulation_id)) return null;
  const details = await loadTeams(new Map([[id, team.regulation_id]]));
  return details.get(id)?.showdown ?? null;
}

/** A public team with everything its page shows, or null if there's none. */
export async function getTeamPage(id: string): Promise<TeamPage | null> {
  if (!UUID.test(id)) return null;
  const { data: team, error } = await supabase()
    .from("teams")
    .select("id, regulation_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Regulations come from core's schedule; a row with another would be a bug.
  if (!team || !isRegulation(team.regulation_id)) return null;

  const [details, placements, media] = await Promise.all([
    loadTeams(new Map([[id, team.regulation_id]])),
    supabase()
      .from("tournament_placements")
      .select("*")
      .eq("team_id", id)
      // Best first, official results before online ones.
      .order("official", { ascending: false })
      .order("placement", { ascending: true, nullsFirst: false })
      .order("player_count", { ascending: false, nullsFirst: false })
      .order("starts_on", { ascending: false }),
    supabase()
      .from("media_links")
      .select("kind, url, start_seconds, title")
      .eq("team_id", id),
  ]);

  const loaded = details.get(id)!;
  return {
    id,
    regulation: team.regulation_id,
    ...loaded,
    pokemon: loaded.pokemon.map((p, i) => ({
      ...p,
      details: setDetails(loaded.team.sets[i]!),
    })),
    placements: check(placements).map((row) => ({
      id: row.id!,
      player: row.player_name ?? "",
      placement: row.placement,
      record: record(row),
      stage: stage(row),
      teamlistUrl: row.teamlist_url,
      event: eventSummary(row),
    })),
    media: check(media).map((link) => ({
      kind: link.kind,
      url: link.url,
      startSeconds: link.start_seconds,
      title: link.title,
    })),
  };
}

// Searches and counts are cached across visitors by their filters (every
// filter, the box included, is in the URL) and by when search data last
// changed, so an import starts fresh results within a minute.

/** When search data last changed, checked at most once a minute. */
const dataVersion = unstable_cache(
  async () => {
    const { data, error } = await supabase()
      .from("search_data_version")
      .select("changed_at")
      .single();
    if (error) throw new Error(error.message);
    return data.changed_at;
  },
  ["search-data-version"],
  { revalidate: 60 },
);

/** The cache key for a search's filters, at the current data version. */
export const searchKey = async (filters: Filters) =>
  `${await dataVersion()} ${filters.sort} ${JSON.stringify(rpcFilters(filters))}`;

export const cachedSearch = async (filters: Filters, page: number) =>
  unstable_cache(
    () => searchTeams(filters, page),
    ["search", await searchKey(filters), String(page)],
    { revalidate: 86400 },
  )();

/** countTeams(), cached, and shared by everything on one page. */
export const cachedCount = cache((key: string, filters: Filters) =>
  unstable_cache(() => countTeams(filters), ["count", key], {
    revalidate: 86400,
  })(),
);

/** A team's results added up, for its page. */
export function resultTotals(placements: TeamPage["placements"]) {
  const known = placements.filter((p) => p.record !== null);
  const [wins, losses] = known.reduce(
    ([w, l], p) => {
      const [pw, pl] = p.record!.split("-").map(Number);
      return [w + pw!, l + pl!];
    },
    [0, 0],
  );
  const official = placements.filter((p) => p.event.official).length;
  return {
    uses: placements.length,
    official,
    online: placements.length - official,
    topCuts: placements.filter((p) => p.stage === "top-cut").length,
    /** Day 2 or better, as the Day 2 filter counts it. */
    dayTwos: placements.filter((p) => p.stage !== null).length,
    /** Every known record added up, or null with none. */
    record: known.length > 0 ? { wins, losses } : null,
  };
}
