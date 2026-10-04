import { REGULATIONS, type Regulation } from "@ots/core";
import { gameData, regulationData } from "@ots/core/game-data";
import { encodeBoxBits, getSpecies } from "@ots/core/teams";
import { readBox } from "./box-server";
import { supabase } from "./supabase";

// What the search bar can suggest. Built on the server from core's game
// data and passed to the bar, so suggesting needs no requests.

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

/** Archetypes and imported events, from the database. */
export async function databaseOptions(): Promise<{
  archetypes: SearchOption[];
  events: EventOption[];
}> {
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
      kind: "archetype",
      id: a.id,
      name: a.name,
    })),
    events: events.data,
  };
}

let cachedGameDataOptions: SearchOption[] | undefined;

/** Everything the search bar needs to suggest, for the page to pass in. */
export async function searchBarProps(): Promise<{
  options: SearchOption[];
  archetypes: SearchOption[];
  events: EventOption[];
  regulations: Regulation[];
  /** How many Pokémon are in the player's box, from their cookie. */
  boxCount: number;
  /** The player's box as URL text (encodeBoxBits), for box searches. */
  boxCode: string;
}> {
  cachedGameDataOptions ??= gameDataOptions();
  const [{ archetypes, events }, box] = await Promise.all([
    databaseOptions(),
    readBox(),
  ]);
  return {
    boxCount: box.size,
    boxCode: encodeBoxBits(box),
    options: cachedGameDataOptions,
    archetypes,
    events,
    // Newest first.
    regulations: REGULATIONS.map((r) => r.id)
      .filter((id) => regulationData[id])
      .reverse(),
  };
}
