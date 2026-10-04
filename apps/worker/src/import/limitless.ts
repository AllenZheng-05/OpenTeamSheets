import { parse as parseYaml } from "yaml";
import { isRegulation, type Regulation } from "@ots/core";
import {
  deriveArchetypes,
  describeSheetError,
  emptySet,
  findId,
  sheetErrors,
  teamFingerprint,
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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Limitless species ids that don't reduce to ours: plain "tauros-paldea"
 * is the Combat Breed, which has no suffix in-game, and plain "floette"
 * (often in online teamlists) is Eternal Floette, the only Floette in
 * Champions and the only one that can hold Floettite.
 */
const SPECIES_ALIASES: Record<string, string> = {
  "tauros-paldea": "taurospaldeacombat",
  floette: "floetteeternal",
};

export const teamlistUrl = (standings: string, tpId: number) =>
  `${STANDINGS_SITE}/${standings}/player/${String(tpId).padStart(4, "0")}/teamlist`;

/**
 * What sheets list for a Pokémon with no item: the bare label "Held Item:"
 * on official sheets, "No Item" online.
 */
const NO_ITEM = /^(?:held item:?|no item|none)$/i;

/**
 * A teamlist as a core team. An item that isn't in the game is kept as
 * listed; other names that aren't in the game data are reported. Limitless's
 * species ids ("indeedee-f") reduce to ours.
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
    sets: sets.map((set): TeamSet => {
      // A Pokémon with no item comes through as a placeholder.
      const item =
        set.item && !NO_ITEM.test(set.item.trim()) ? set.item.trim() : null;
      const itemId = item ? findId("item", item) : null;
      return {
        ...emptySet(),
        speciesId: lookup("species", SPECIES_ALIASES[set.id] ?? set.id),
        itemId,
        listedItem: item && !itemId ? item : null,
        abilityId: lookup("ability", set.ability),
        natureId: lookup("nature", set.nature),
        moveIds: set.moves
          .map((move) => lookup("move", move))
          .filter((move): move is string => move !== null),
      };
    }),
  };
  return { team, unknown };
}

/** A player skipped, or imported with errors on their team sheet. */
export interface PlayerNote {
  player: string;
  placement: number | null;
  /** Their teamlist page, when they have one. */
  teamlistUrl: string | null;
  reasons: string[];
}

export interface PreparedEvent {
  /** The argument for import_event(), without its teams. */
  event: Record<string, unknown>;
  teams: Record<string, unknown>[];
  /** Players without a teamlist, or whose teamlist names something unknown. */
  skipped: PlayerNote[];
  /** Players imported with their sheet as published, errors and all. */
  sheetErrors: PlayerNote[];
}

/** One player's result and team, from either Limitless source. */
export interface PlayerEntry {
  name: string;
  /** Their id on the source, which tells apart players sharing a name. */
  sourcePlayerId: string;
  placement: number | null;
  wins: number;
  losses: number;
  droppedRound: number | null;
  madeDayTwo: boolean;
  madeTopCut: boolean;
  teamlistUrl: string | null;
  /** Their team, or null without a public teamlist. */
  sets: LimitlessSet[] | null;
}

/**
 * The teams to import for an event's players. Players without a teamlist,
 * or whose teamlist names something that isn't in the game data, are
 * skipped. Players without a placement (online, those who dropped) are
 * imported with their record. A team sheet with errors (typos made when it was entered) is
 * imported as published, since the record is what it says, and reported.
 */
export function prepareTeams(
  players: PlayerEntry[],
  regulation: Regulation,
): Pick<PreparedEvent, "teams" | "skipped" | "sheetErrors"> {
  const skipped: PlayerNote[] = [];
  const flagged: PlayerNote[] = [];
  const teams: Record<string, unknown>[] = [];

  for (const player of players) {
    const note = (list: PlayerNote[], reasons: string[]) =>
      list.push({
        player: player.name,
        placement: player.placement,
        teamlistUrl: player.teamlistUrl,
        reasons,
      });
    if (!player.sets) {
      note(skipped, ["No teamlist"]);
      continue;
    }
    const { team, unknown } = teamFromLimitless(player.sets);
    if (unknown.length > 0) {
      note(
        skipped,
        unknown.map((name) => `Unknown ${name}`),
      );
      continue;
    }
    const errors = sheetErrors(team, regulation);
    if (errors.length > 0) note(flagged, errors.map(describeSheetError));
    teams.push({
      fingerprint: teamFingerprint(team, regulation),
      archetypes: deriveArchetypes(team),
      // For search; team pages work out their own when they load.
      sheetErrors: errors,
      playerName: player.name,
      sourcePlayerId: player.sourcePlayerId,
      placement: player.placement,
      wins: player.wins,
      losses: player.losses,
      madeDayTwo: player.madeDayTwo,
      madeTopCut: player.madeTopCut,
      droppedRound: player.droppedRound,
      teamlistUrl: player.teamlistUrl,
      sets: team.sets.map((set, index) => ({
        slot: index + 1,
        speciesId: set.speciesId,
        itemId: set.itemId,
        listedItem: set.listedItem ?? null,
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
  return { teams, skipped, sheetErrors: flagged };
}

/**
 * Builds the import for one official event from its standings and the
 * teamlists fetched so far (by tp_id).
 */
export function prepareOfficialEvent(
  config: OfficialEvent,
  standings: { tournament: LimitlessTournament; players: LimitlessStanding[] },
  teamlists: Map<number, LimitlessSet[]>,
): PreparedEvent {
  const { tournament, players } = standings;
  const { startsOn, endsOn } = readDates(tournament.date);
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
    ...prepareTeams(
      players.map((player) => ({
        name: player.name,
        sourcePlayerId: String(player.player_id),
        placement: player.placement,
        wins: player.wins,
        losses: player.losses,
        droppedRound: player.drop_round,
        madeDayTwo: player.day2 === 1,
        madeTopCut: player.topcut === 1,
        teamlistUrl: player.teamlist
          ? teamlistUrl(config.standings, player.tp_id)
          : null,
        sets: player.teamlist ? (teamlists.get(player.tp_id) ?? null) : null,
      })),
      config.regulation,
    ),
  };
}
