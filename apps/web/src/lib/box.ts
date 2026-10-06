// A player's box: the Pokémon they own (core's box species), kept in a
// cookie so search can find teams they can build without an account. Pure,
// so the box page and the server share it.

export const BOX_COOKIE = "box";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * The box as a cookie value: "+" and the owned ids, or "-" and the ones
 * not owned, whichever is shorter, so a nearly full box stays small.
 * Ids are letters and digits, joined with dots.
 */
export function encodeBox(owned: Set<string>, all: string[]): string {
  const have = all.filter((id) => owned.has(id));
  const lack = all.filter((id) => !owned.has(id));
  return have.length <= lack.length
    ? `+${have.join(".")}`
    : `-${lack.join(".")}`;
}

/** The owned ids in a cookie value, ignoring any that aren't in `all`. */
export function decodeBox(
  value: string | undefined,
  all: string[],
): Set<string> {
  if (!value || (value[0] !== "+" && value[0] !== "-")) return new Set();
  const listed = new Set(value.slice(1).split(".").filter(Boolean));
  return new Set(
    all.filter((id) => (value[0] === "+" ? listed.has(id) : !listed.has(id))),
  );
}

/** Sets the box cookie in the browser. */
export function saveBox(owned: Set<string>, all: string[]) {
  document.cookie = `${BOX_COOKIE}=${encodeBox(owned, all)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

export const BOX_SORT_COOKIE = "box-sort";

/** A box sort from its cookie, most used first by default. */
export const readBoxSort = (value: string | undefined): BoxSort =>
  value === "dex" || value === "type" ? value : "usage";

/** Remembers the box's sort in the browser. */
export function saveBoxSort(sort: BoxSort) {
  document.cookie = `${BOX_SORT_COOKIE}=${sort}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/** A Pokémon in the box grid. */
export interface BoxTileView {
  id: string;
  name: string;
  spriteId: string;
  types: string[];
  /** The share of the regulation's tournament teams using it, 0 to 1. */
  usage: number;
  /** The regulation it was first legal in. */
  added: string;
}

export type BoxSort = "dex" | "usage" | "type";

export const BOX_SORTS: { id: BoxSort; label: string }[] = [
  { id: "usage", label: "Usage" },
  { id: "dex", label: "Pokédex" },
  { id: "type", label: "Type" },
];

/** The games' order of types. */
const TYPE_ORDER = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];

const typeRank = (type: string | undefined) =>
  type === undefined ? -1 : TYPE_ORDER.indexOf(type);

/**
 * Tiles in Pokédex order, re-sorted: by usage, most used first, or by type
 * (first type, then second, single-typed first). Ties keep Pokédex order.
 */
export function sortTiles(tiles: BoxTileView[], by: BoxSort): BoxTileView[] {
  if (by === "dex") return tiles;
  const compare =
    by === "usage"
      ? (a: BoxTileView, b: BoxTileView) => b.usage - a.usage
      : (a: BoxTileView, b: BoxTileView) =>
          typeRank(a.types[0]) - typeRank(b.types[0]) ||
          typeRank(a.types[1]) - typeRank(b.types[1]);
  // Array.prototype.sort is stable, so ties stay in Pokédex order.
  return [...tiles].sort(compare);
}

export const BOX_GROUP_COOKIE = "box-group";

/** Remembers whether the box is grouped by regulation added. */
export function saveBoxGroup(grouped: boolean) {
  document.cookie = `${BOX_GROUP_COOKIE}=${grouped ? "1" : "0"}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/**
 * Tiles grouped by the regulation they were added in, newest first, each
 * group keeping the tiles' order. `regulations` lists them oldest first.
 */
export function groupByAdded(
  tiles: BoxTileView[],
  regulations: string[],
): { regulation: string; tiles: BoxTileView[] }[] {
  return [...regulations]
    .reverse()
    .map((regulation) => ({
      regulation,
      tiles: tiles.filter((t) => t.added === regulation),
    }))
    .filter((group) => group.tiles.length > 0);
}

/** A cookie's value in the browser, or undefined. */
export function browserCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);
}
