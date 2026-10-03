import { isRegulation, type Regulation } from "@ots/core";
import {
  describeSheetError,
  exportShowdown,
  sheetErrors,
  type Team,
} from "@ots/core/teams";
import { dateRange } from "./format";
import { pokemonView, setFromRow, type PokemonView } from "./pokemon";
import { supabase } from "./supabase";

export const PAGE_SIZE = 25;

/** How far a player went: all placements, day 2 and better, or top cut. */
export type Stage = "all" | "day-2" | "top-cut";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "all", label: "All teams" },
  { id: "day-2", label: "Day 2" },
  { id: "top-cut", label: "Top cut" },
];

export function readStage(value: string | string[] | undefined): Stage {
  return value === "day-2" || value === "top-cut" ? value : "all";
}

export interface Archetype {
  id: string;
  name: string;
}

export interface EventSummary {
  slug: string;
  name: string;
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
  /** The team as a Showdown paste, for Copy team. */
  showdown: string;
  /** Whether the team sheet, as published, has errors. */
  hasSheetErrors: boolean;
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
  regulation_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  player_count: number | null;
  standings_url: string | null;
};

const eventSummary = (row: PlacementRecord): EventSummary => ({
  slug: row.event_slug ?? "",
  name: row.event_name ?? "",
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
 * A page of tournament placements, newest event first, then by placement,
 * with the total for page numbers. Day 2 includes the top cut.
 */
export async function browsePlacements(
  filter: Stage,
  page: number,
): Promise<{ rows: PlacementRow[]; total: number }> {
  const from = page * PAGE_SIZE;
  let query = supabase()
    .from("tournament_placements")
    .select("*", { count: "exact" });
  if (filter === "top-cut") query = query.eq("made_top_cut", true);
  if (filter === "day-2") query = query.eq("made_day_two", true);
  const { data, count, error } = await query
    .order("starts_on", { ascending: false })
    .order("event_id")
    .order("placement", { ascending: true, nullsFirst: false })
    .order("player_name")
    .range(from, from + PAGE_SIZE - 1);
  // Asking for rows past the end is an error (PGRST103); it's an empty page.
  if (error?.code === "PGRST103") return { rows: [], total: count ?? 0 };
  if (error) throw new Error(error.message);
  const records = data ?? [];
  const teams = await loadTeams(
    new Map(
      records.flatMap((r): [string, Regulation][] =>
        r.regulation_id && isRegulation(r.regulation_id)
          ? [[r.team_id!, r.regulation_id]]
          : [],
      ),
    ),
  );

  return {
    // Every team has a regulation; one without would be skipped, not shown.
    rows: records
      .filter((row) => teams.has(row.team_id!))
      .map((row) => {
        const details = teams.get(row.team_id!)!;
        return {
          id: row.id!,
          teamId: row.team_id!,
          player: row.player_name ?? "",
          placement: row.placement,
          record: record(row),
          stage: stage(row),
          event: eventSummary(row),
          archetypes: details.archetypes,
          pokemon: details.pokemon,
          showdown: details.showdown,
          hasSheetErrors: details.sheetErrors.length > 0,
        };
      }),
    total: count ?? 0,
  };
}

export interface TeamPage extends TeamDetails {
  id: string;
  regulation: Regulation;
  placements: (Omit<
    PlacementRow,
    "pokemon" | "archetypes" | "showdown" | "teamId" | "hasSheetErrors"
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
      .order("starts_on", { ascending: false })
      .order("placement"),
    supabase()
      .from("media_links")
      .select("kind, url, start_seconds, title")
      .eq("team_id", id),
  ]);

  return {
    id,
    regulation: team.regulation_id,
    ...details.get(id)!,
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
