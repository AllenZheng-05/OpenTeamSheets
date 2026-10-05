import { unstable_cache } from "next/cache";
import { REGULATIONS, type Regulation } from "@ots/core";
import { gameData, regulationData } from "@ots/core/game-data";
import { encodeBoxBits, getSpecies, nameOf } from "@ots/core/teams";
import { readBox } from "./box-server";
import type { Filters } from "./search";
import { supabase } from "./supabase";

// What the search bar can suggest: built on the server from core's game
// data and the database, and loaded by the bar once from a cached route.

export type OptionKind =
  "pokemon" | "move" | "ability" | "item" | "type" | "archetype";

export interface SearchOption {
  kind: OptionKind;
  id: string;
  name: string;
}

export interface EventOption {
  slug: string;
  name: string;
  official: boolean;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "en");

const regulations = Object.values(regulationData);

/** Ids legal in any regulation, since search covers every regulation. */
const everLegal = (pick: (data: (typeof regulations)[number]) => string[]) =>
  new Set(regulations.flatMap((data) => (data ? pick(data) : [])));

/**
 * Pokémon (with each Mega as its own option), moves, abilities, items and
 * types that appear in any regulation, by name.
 */
export function gameDataOptions(): SearchOption[] {
  const legalSpecies = everLegal((d) => d.legality.species);
  const species = gameData.species.filter(
    (s) =>
      legalSpecies.has(s.id) ||
      (s.battleOnlyFromId !== null &&
        s.requiredItemId !== null &&
        legalSpecies.has(s.battleOnlyFromId)),
  );
  const moves = everLegal((d) => Object.values(d.learnsets).flat());
  const abilities = new Set(
    species.flatMap((s) => [s.ability1, s.ability2, s.abilityHidden]),
  );
  const items = everLegal((d) => d.legality.items);

  const options = (
    kind: OptionKind,
    records: { id: string; name: string }[],
    keep: (id: string) => boolean = () => true,
  ): SearchOption[] =>
    records
      .filter((r) => keep(r.id))
      .sort(byName)
      .map((r) => ({ kind, id: r.id, name: r.name }));

  return [
    ...options("pokemon", species),
    ...options("move", gameData.moves, (id) => moves.has(id)),
    ...options("ability", gameData.abilities, (id) => abilities.has(id)),
    ...options("item", gameData.items, (id) => items.has(id)),
    ...options("type", gameData.types),
  ];
}

/**
 * The moves and abilities a Pokémon can have in any regulation, for adding
 * details to it. A Mega is checked as the form it changes from, plus its
 * own ability, which official sheets sometimes list.
 */
export function pokemonDetails(pokemonId: string): {
  moves: string[];
  abilities: string[];
} {
  const species = getSpecies(pokemonId);
  if (!species) return { moves: [], abilities: [] };
  const form = getSpecies(species.battleOnlyFromId ?? species.id) ?? species;
  const moves = new Set(
    regulations.flatMap((data) => data?.learnsets[form.id] ?? []),
  );
  const abilities = new Set(
    [species, form]
      .flatMap((s) => [s.ability1, s.ability2, s.abilityHidden])
      .filter((a): a is string => a !== null),
  );
  return { moves: [...moves].sort(), abilities: [...abilities].sort() };
}

/** Archetypes and imported events, from the database, cached for an hour. */
const databaseOptions = unstable_cache(
  async (): Promise<{ archetypes: SearchOption[]; events: EventOption[] }> => {
    const [archetypes, events] = await Promise.all([
      supabase().from("archetypes").select("id, name").order("name"),
      supabase()
        .from("events")
        .select("slug, name, official")
        .order("starts_on", { ascending: false }),
    ]);
    if (archetypes.error) throw new Error(archetypes.error.message);
    if (events.error) throw new Error(events.error.message);
    return {
      archetypes: archetypes.data.map((a) => ({
        kind: "archetype" as const,
        id: a.id,
        name: a.name,
      })),
      events: events.data,
    };
  },
  ["search-database-options"],
  { revalidate: 3600 },
);

let cachedGameDataOptions: SearchOption[] | undefined;

/** What the search bar suggests and lists, served by /api/search-options. */
export interface SearchOptionsData {
  /** Pokémon, moves, abilities, items and types. */
  options: SearchOption[];
  events: EventOption[];
}

export async function searchOptionsData(): Promise<SearchOptionsData> {
  cachedGameDataOptions ??= gameDataOptions();
  const { events } = await databaseOptions();
  return { options: cachedGameDataOptions, events };
}

/**
 * The names of what a search already names (its pills), keyed
 * "kind:id", so they show before the full list has loaded.
 */
function filterNames(filters: Filters): Record<string, string> {
  const names: Record<string, string> = {};
  for (const c of [...filters.has, ...filters.not]) {
    if (c.pokemon) names[`pokemon:${c.pokemon}`] = nameOf("species", c.pokemon);
    for (const m of c.moves ?? []) names[`move:${m}`] = nameOf("move", m);
    if (c.ability) names[`ability:${c.ability}`] = nameOf("ability", c.ability);
    if (c.item) names[`item:${c.item}`] = nameOf("item", c.item);
    if (c.type) {
      names[`type:${c.type}`] =
        gameData.types.find((t) => t.id === c.type)?.name ?? c.type;
    }
  }
  return names;
}

/**
 * What the search bar needs from the server. The long list of suggestions
 * isn't here: the bar loads it from /api/search-options, which browsers
 * cache across pages.
 */
export async function searchBarProps(filters: Filters): Promise<{
  archetypes: SearchOption[];
  names: Record<string, string>;
  regulations: Regulation[];
  /** How many Pokémon are in the player's box, from their cookie. */
  boxCount: number;
  /** The player's box as URL text (encodeBoxBits), for box searches. */
  boxCode: string;
}> {
  const [{ archetypes }, box] = await Promise.all([
    databaseOptions(),
    readBox(),
  ]);
  return {
    boxCount: box.size,
    boxCode: encodeBoxBits(box),
    archetypes,
    names: filterNames(filters),
    // Newest first.
    regulations: REGULATIONS.map((r) => r.id)
      .filter((id) => regulationData[id])
      .reverse(),
  };
}
