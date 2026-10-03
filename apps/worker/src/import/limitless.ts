import { parse as parseYaml } from "yaml";
import { isRegulation, type Regulation } from "@ots/core";
import {
  deriveArchetypes,
  emptySet,
  findId,
  teamFingerprint,
  validateTeam,
  type Team,
  type TeamSet,
} from "@ots/core/teams";

// Official results from Limitless VGC's standings site
// (standings.limitlessvgc.com). Its pages embed their data as JSON, the
// same data they render, so the importer reads that rather than the HTML.

export const STANDINGS_SITE = "https://standings.limitlessvgc.com";

/** An official event from data/official-events.yaml. */
export interface OfficialEvent {
  /** The event's id on limitlessvgc.com. */
  id: number;
  /** Its standings site id, such as "0037". */
  standings: string;
  name: string;
  regulation: Regulation;
}

/** Event details from a standings page. */
export interface LimitlessTournament {
  type: string;
  city: string;
  date: string;
  players: number;
  players_r1: number | null;
  completed: number;
}

/** One player's line in a standings page. */
export interface LimitlessStanding {
  player_id: number;
  /** The player's id on the standings site, used in their teamlist's URL. */
  tp_id: number;
  name: string;
  placement: number | null;
  wins: number;
  losses: number;
  drop_round: number | null;
  day2: number;
  topcut: number;
  teamlist: number;
}

/** One Pokémon in a teamlist page. */
export interface LimitlessSet {
  id: string;
  name: string;
  item: string | null;
  ability: string | null;
  nature: string | null;
  moves: string[];
}

/** Reads data/official-events.yaml, or throws listing what's wrong. */
export function readOfficialEvents(text: string): OfficialEvent[] {
  const data = parseYaml(text) as { events?: unknown };
  if (!Array.isArray(data?.events)) {
    throw new Error("official-events.yaml needs an `events` list");
  }
  const problems: string[] = [];
  const events = data.events as Record<string, unknown>[];
  events.forEach((event, index) => {
    const where = `event ${index + 1}`;
    if (!Number.isInteger(event.id))
      problems.push(`${where}: \`id\` must be a number`);
    if (typeof event.standings !== "string" || !/^\d+$/.test(event.standings)) {
      problems.push(
        `${where}: \`standings\` must be a quoted id such as "0037"`,
      );
    }
    if (typeof event.name !== "string" || !event.name) {
      problems.push(`${where}: \`name\` must be text`);
    }
    if (
      typeof event.regulation !== "string" ||
      !isRegulation(event.regulation)
    ) {
      problems.push(
        `${where}: \`regulation\` must be a regulation such as M-C`,
      );
    }
  });
  if (problems.length > 0) throw new Error(problems.join("\n"));
  return events as unknown as OfficialEvent[];
}

/**
 * The JSON a standings site page embeds, keyed by the endpoint it came
 * from ("tournament", "standings", "teamlist", "player").
 */
export function readEmbeddedData(html: string): Map<string, unknown> {
  const data = new Map<string, unknown>();
  const scripts = html.matchAll(
    /<script[^>]*data-sveltekit-fetched[^>]*data-url="([^"]*)"[^>]*>([^<]*)<\/script>/g,
  );
  for (const [, url, text] of scripts) {
    const endpoint = new URL(url!.replaceAll("&amp;", "&")).pathname
      .split("/")
      .at(-1)!;
    const response = JSON.parse(text!) as { body: string };
    data.set(
      endpoint,
      (JSON.parse(response.body) as { message: unknown }).message,
    );
  }
  return data;
}

/** A standings page's event details and every player's standing. */
export function readStandingsPage(html: string): {
  tournament: LimitlessTournament;
  players: LimitlessStanding[];
} {
  const data = readEmbeddedData(html);
  const tournament = data.get("tournament") as LimitlessTournament | undefined;
  const players = data.get("standings") as LimitlessStanding[] | undefined;
  if (!tournament || !Array.isArray(players)) {
    throw new Error(
      "The standings page has no embedded standings; its format may have changed",
    );
  }
  return { tournament, players };
}

/** A teamlist page's Pokémon. */
export function readTeamlistPage(html: string): LimitlessSet[] {
  const sets = readEmbeddedData(html).get("teamlist");
  if (!Array.isArray(sets)) {
    throw new Error(
      "The teamlist page has no embedded team; its format may have changed",
    );
  }
  return sets as LimitlessSet[];
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const isoDate = (year: string, month: string, day: string) => {
  const index = MONTHS.indexOf(month.toLowerCase());
  if (index === -1) throw new Error(`Unknown month "${month}"`);
  return `${year}-${String(index + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
};

/**
 * "September 18–20, 2026", "August 31 – September 2, 2026" or
 * "June 6, 2026" as start and end dates.
 */
export function readDates(text: string): { startsOn: string; endsOn: string } {
  const normalized = text.replace(/\s*[–-]\s*/g, "–").trim();
  let match = normalized.match(/^([A-Za-z]+) (\d{1,2})–(\d{1,2}), (\d{4})$/);
  if (match) {
    const [, month, from, to, year] = match;
    return {
      startsOn: isoDate(year!, month!, from!),
      endsOn: isoDate(year!, month!, to!),
    };
  }
  match = normalized.match(
    /^([A-Za-z]+) (\d{1,2})–([A-Za-z]+) (\d{1,2}), (\d{4})$/,
  );
  if (match) {
    const [, fromMonth, from, toMonth, to, year] = match;
    return {
      startsOn: isoDate(year!, fromMonth!, from!),
      endsOn: isoDate(year!, toMonth!, to!),
    };
  }
  match = normalized.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (match) {
    const day = isoDate(match[3]!, match[1]!, match[2]!);
    return { startsOn: day, endsOn: day };
  }
  throw new Error(`Couldn't read the date "${text}"`);
}

/** The event's URL name: "worlds-2026", or the city and year ("baltimore-2026"). */
export function eventSlug(
  tournament: LimitlessTournament,
  year: string,
): string {
  const place = tournament.type === "worlds" ? "worlds" : tournament.city;
  return `${place}-${year}`
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const teamlistUrl = (standings: string, tpId: number) =>
  `${STANDINGS_SITE}/${standings}/player/${String(tpId).padStart(4, "0")}/teamlist`;

/**
 * A teamlist as a core team. Names that aren't in the game data are
 * reported; Limitless's species ids ("indeedee-f") reduce to ours.
 */
export function teamFromLimitless(sets: LimitlessSet[]): {
  team: Team;
  unknown: string[];
} {
  const unknown: string[] = [];
  const lookup = (kind: Parameters<typeof findId>[0], name: string | null) => {
    if (!name) return null;
    const id = findId(kind, name);
    if (!id) unknown.push(`${kind} "${name}"`);
    return id;
  };
  const team: Team = {
    sets: sets.map((set): TeamSet => ({
      ...emptySet(),
      speciesId: lookup("species", set.id),
      // A Pokémon with no item comes through as the bare label "Held Item:".
      itemId: lookup(
        "item",
        set.item && /^held item:?$/i.test(set.item.trim()) ? null : set.item,
      ),
      abilityId: lookup("ability", set.ability),
      natureId: lookup("nature", set.nature),
      moveIds: set.moves
        .map((move) => lookup("move", move))
        .filter((move): move is string => move !== null),
    })),
  };
  return { team, unknown };
}

export interface SkippedPlayer {
  player: string;
  placement: number | null;
  reasons: string[];
}

export interface PreparedEvent {
  /** The argument for import_event(), without its teams. */
  event: Record<string, unknown>;
  teams: Record<string, unknown>[];
  skipped: SkippedPlayer[];
}

/**
 * Builds the import for one event from its standings and the teamlists
 * fetched so far (by tp_id). Players without a teamlist, and teams that
 * don't pass validation, are skipped and reported rather than blocking the
 * rest.
 */
export function prepareOfficialEvent(
  config: OfficialEvent,
  standings: { tournament: LimitlessTournament; players: LimitlessStanding[] },
  teamlists: Map<number, LimitlessSet[]>,
): PreparedEvent {
  const { tournament, players } = standings;
  const { startsOn, endsOn } = readDates(tournament.date);
  const skipped: SkippedPlayer[] = [];
  const teams: Record<string, unknown>[] = [];

  for (const player of players) {
    const skip = (reasons: string[]) =>
      skipped.push({
        player: player.name,
        placement: player.placement,
        reasons,
      });
    const sets = teamlists.get(player.tp_id);
    if (player.placement === null || !player.teamlist || !sets) {
      skip(["No teamlist"]);
      continue;
    }
    const { team, unknown } = teamFromLimitless(sets);
    const { errors } = validateTeam(team, config.regulation, {
      complete: true,
    });
    if (unknown.length > 0 || errors.length > 0) {
      skip([
        ...unknown.map((name) => `Unknown ${name}`),
        ...errors.map((e) =>
          e.slot ? `Slot ${e.slot}: ${e.message}` : e.message,
        ),
      ]);
      continue;
    }
    teams.push({
      fingerprint: teamFingerprint(team, config.regulation),
      archetypes: deriveArchetypes(team),
      playerName: player.name,
      sourcePlayerId: String(player.player_id),
      placement: player.placement,
      wins: player.wins,
      losses: player.losses,
      madeDayTwo: player.day2 === 1,
      madeTopCut: player.topcut === 1,
      droppedRound: player.drop_round,
      teamlistUrl: teamlistUrl(config.standings, player.tp_id),
      sets: team.sets.map((set, index) => ({
        slot: index + 1,
        speciesId: set.speciesId,
        itemId: set.itemId,
        abilityId: set.abilityId,
        natureId: set.natureId,
        moves: set.moveIds,
        statPoints: null,
        level: set.level,
        ivs: set.ivs,
        shiny: set.shiny,
      })),
      media: [],
    });
  }

  return {
    event: {
      source: "limitlessvgc",
      sourceId: config.standings,
      slug: eventSlug(tournament, endsOn.slice(0, 4)),
      name: config.name,
      regulationId: config.regulation,
      official: true,
      startsOn,
      endsOn,
      playerCount: tournament.players_r1 ?? tournament.players,
      standingsUrl: `${STANDINGS_SITE}/${config.standings}/standings`,
      topCutSize: players.filter((p) => p.topcut === 1).length,
    },
    teams,
    skipped,
  };
}
