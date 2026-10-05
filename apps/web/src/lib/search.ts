import { isRegulation, type Regulation } from "@ots/core";
import { boxBitString, decodeBoxBits } from "@ots/core/teams";

// Search filters, as the URL holds them and as search_placements() takes
// them. Pure, so pages and the search bar share it.

/** How far a player went: all placements, day 2 and better, or top cut. */
export type Stage = "all" | "day-2" | "top-cut";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "all", label: "All teams" },
  { id: "day-2", label: "Day 2" },
  { id: "top-cut", label: "Top cut" },
];

/**
 * Something one Pokémon on the team must match. Fields are optional, and
 * all of those given must be on the same Pokémon: { pokemon: "incineroar",
 * moves: ["knockoff"] } is an Incineroar with Knock Off.
 */
export interface Condition {
  pokemon?: string;
  moves?: string[];
  ability?: string;
  item?: string;
  type?: string;
}

/** Placement cutoffs offered, besides any number typed in. */
export const TOP_CUTOFFS = [1, 2, 4, 8, 16];
const MAX_TOP = 10_000;

/** "Top 8", "Day 2", "Top cut", or empty for any placement. */
export const placementLabel = (stage: Stage, top: number | null) =>
  top !== null
    ? `Top ${top}`
    : stage === "day-2"
      ? "Day 2"
      : stage === "top-cut"
        ? "Top cut"
        : "";

/** Typed placement text as a stage and cutoff, or null if it isn't one. */
export function readPlacement(
  text: string,
): { stage: Stage; top: number | null } | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (t === "" || t === "any") return { stage: "all", top: null };
  if (t === "day 2" || t === "day2") return { stage: "day-2", top: null };
  if (t === "top cut" || t === "topcut") return { stage: "top-cut", top: null };
  const n = Number(t.replace(/^top ?/, ""));
  return Number.isInteger(n) && n >= 1 ? { stage: "all", top: n } : null;
}

/** Which events: official ones, online ones, or both. */
export type EventKind = "all" | "official" | "online";

export const EVENT_KINDS: { id: EventKind; label: string }[] = [
  { id: "all", label: "Official and online" },
  { id: "official", label: "Official only" },
  { id: "online", label: "Online only" },
];

/** How many of a team's Pokémon may be missing from the player's box. */
export type BoxMatch = 0 | 1 | 2;

export const BOX_MATCHES: { id: BoxMatch; label: string }[] = [
  { id: 0, label: "Only Pokémon in my box" },
  { id: 1, label: "Missing at most 1" },
  { id: 2, label: "Missing at most 2" },
];

/** How team results are ordered. */
export type TeamSort = "used" | "newest" | "best";

export const TEAM_SORTS: { id: TeamSort; label: string }[] = [
  { id: "used", label: "Most used" },
  { id: "newest", label: "Newest" },
  { id: "best", label: "Best results" },
];

export type SheetErrorFilter = "any" | "unexplained" | "none";

export const SHEET_ERROR_FILTERS: { id: SheetErrorFilter; label: string }[] = [
  { id: "any", label: "Any sheet errors" },
  { id: "unexplained", label: "Unexplained sheet errors" },
  { id: "none", label: "No sheet errors" },
];

export interface Filters {
  /** Conditions the team must all match, each on any Pokémon. */
  has: Condition[];
  /** Conditions no Pokémon on the team may match. */
  not: Condition[];
  archetypes: string[];
  notArchetypes: string[];
  /** Text a player's name contains; a placement matches any of them. */
  players: string[];
  notPlayers: string[];
  errors: SheetErrorFilter | null;
  /** Defaults to the current regulation, since the meta changes. */
  regulation: Regulation | "all";
  /** An event slug. */
  event: string | null;
  stage: Stage;
  /** Only placements this good or better, such as 8 for the top 8. */
  top: number | null;
  kind: EventKind;
  /** Match a box; null for any team. */
  box: BoxMatch | null;
  /**
   * The box matched, as core's encodeBoxBits() text, so the URL alone
   * decides the results (and they can be cached and shared). Null until
   * filled in from the player's box.
   */
  have: string | null;
  /** How results are ordered; most used first by default. */
  sort: TeamSort;
}

export const emptyFilters = (regulation: Regulation): Filters => ({
  has: [],
  not: [],
  archetypes: [],
  notArchetypes: [],
  players: [],
  notPlayers: [],
  errors: null,
  regulation,
  event: null,
  stage: "all",
  top: null,
  kind: "all",
  box: null,
  have: null,
  sort: "used",
});

const ID = /^[a-z0-9-]+$/;
const MAX_PLAYER_LENGTH = 50;

type Params = Record<string, string | string[] | undefined>;

const all = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/**
 * "pokemon:incineroar,move:knockoff" as a condition, or null if it's
 * malformed. Each field appears once, except moves (up to four).
 */
export function readCondition(text: string): Condition | null {
  const condition: Condition = {};
  for (const part of text.split(",")) {
    const [kind, id, extra] = part.split(":");
    if (!kind || !id || extra !== undefined || !ID.test(id)) return null;
    if (kind === "move") {
      condition.moves = [...(condition.moves ?? []), id];
      if (condition.moves.length > 4) return null;
    } else if (
      kind === "pokemon" ||
      kind === "ability" ||
      kind === "item" ||
      kind === "type"
    ) {
      if (condition[kind]) return null;
      condition[kind] = id;
    } else {
      return null;
    }
  }
  return condition;
}

export function writeCondition(condition: Condition): string {
  return [
    condition.pokemon && `pokemon:${condition.pokemon}`,
    ...(condition.moves ?? []).map((move) => `move:${move}`),
    condition.ability && `ability:${condition.ability}`,
    condition.item && `item:${condition.item}`,
    condition.type && `type:${condition.type}`,
  ]
    .filter(Boolean)
    .join(",");
}

/**
 * Filters from a page's search params. Anything malformed is left out
 * rather than failing, so an edited or old link still works.
 */
export function readFilters(params: Params, current: Regulation): Filters {
  const filters = emptyFilters(current);
  for (const [key, list] of [
    ["has", filters.has],
    ["not", filters.not],
  ] as const) {
    const archetypes =
      key === "has" ? filters.archetypes : filters.notArchetypes;
    for (const text of all(params[key])) {
      const archetype = text.match(/^archetype:([a-z0-9-]+)$/)?.[1];
      if (archetype) {
        if (!archetypes.includes(archetype)) archetypes.push(archetype);
        continue;
      }
      const condition = readCondition(text);
      if (
        condition &&
        !list.some((c) => writeCondition(c) === writeCondition(condition))
      ) {
        list.push(condition);
      }
    }
  }
  const players = (value: string | string[] | undefined) => [
    ...new Set(
      all(value)
        .map((name) => name.trim())
        .filter((name) => name && name.length <= MAX_PLAYER_LENGTH),
    ),
  ];
  filters.players = players(params.player);
  filters.notPlayers = players(params["not-player"]);

  const errors = params.errors;
  if (errors === "any" || errors === "unexplained" || errors === "none") {
    filters.errors = errors;
  }
  const regulation = params.reg;
  if (regulation === "all") filters.regulation = "all";
  else if (typeof regulation === "string" && isRegulation(regulation)) {
    filters.regulation = regulation;
  }
  const event = params.event;
  if (typeof event === "string" && ID.test(event)) filters.event = event;
  const stage = params.stage;
  if (stage === "day-2" || stage === "top-cut") filters.stage = stage;
  const top = Number(params.top);
  if (Number.isInteger(top) && top >= 1 && top <= MAX_TOP) filters.top = top;
  const kind = params.kind;
  if (kind === "official" || kind === "online") filters.kind = kind;
  const box = params.box;
  if (box === "0" || box === "1" || box === "2") {
    filters.box = Number(box) as BoxMatch;
  }
  const sort = params.sort;
  if (sort === "newest" || sort === "best") filters.sort = sort;
  const have = params.have;
  if (typeof have === "string" && decodeBoxBits(have) !== null) {
    filters.have = have;
  }
  return filters;
}

/**
 * A path with the filters and page as its query, leaving out defaults:
 * filtersHref("/tournament", filters, current, 2).
 */
export function filtersHref(
  path: string,
  filters: Filters,
  current: Regulation,
  page = 1,
): string {
  const params = new URLSearchParams();
  for (const c of filters.has) params.append("has", writeCondition(c));
  for (const a of filters.archetypes) params.append("has", `archetype:${a}`);
  for (const c of filters.not) params.append("not", writeCondition(c));
  for (const a of filters.notArchetypes) params.append("not", `archetype:${a}`);
  for (const p of filters.players) params.append("player", p);
  for (const p of filters.notPlayers) params.append("not-player", p);
  if (filters.errors) params.set("errors", filters.errors);
  if (filters.event) params.set("event", filters.event);
  if (filters.stage !== "all") params.set("stage", filters.stage);
  if (filters.top) params.set("top", String(filters.top));
  if (filters.kind !== "all") params.set("kind", filters.kind);
  if (filters.sort !== "used") params.set("sort", filters.sort);
  if (filters.box !== null) {
    params.set("box", String(filters.box));
    if (filters.have !== null) params.set("have", filters.have);
  }
  if (filters.regulation !== current) params.set("reg", filters.regulation);
  if (page > 1) params.set("page", String(page));
  // Keep the separators readable: "has=pokemon:incineroar,move:knockoff".
  const text = params.toString().replace(/%3A/g, ":").replace(/%2C/g, ",");
  return text ? `${path}?${text}` : path;
}

/** Whether anything beyond the defaults is chosen. */
export function hasFilters(filters: Filters, current: Regulation): boolean {
  return filtersHref("", filters, current) !== "";
}

/**
 * The argument for search_placements(), with the box as a bit mask when
 * the search matches one (an empty box without `have`).
 */
export function rpcFilters(filters: Filters) {
  return {
    ...(filters.box !== null && {
      boxBits: boxBitString(decodeBoxBits(filters.have ?? "") ?? []),
      boxMissing: filters.box,
    }),
    has: filters.has,
    not: filters.not,
    archetypes: filters.archetypes,
    notArchetypes: filters.notArchetypes,
    players: filters.players,
    notPlayers: filters.notPlayers,
    errors: filters.errors,
    regulation: filters.regulation === "all" ? null : filters.regulation,
    event: filters.event,
    stage: filters.stage === "all" ? null : filters.stage,
    top: filters.top,
    kind: filters.kind === "all" ? null : filters.kind,
  };
}
