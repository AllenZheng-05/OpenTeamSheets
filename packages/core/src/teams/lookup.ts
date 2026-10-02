import { gameData } from "../game-data/data";
import type { Species } from "../game-data/types";
import { toId } from "../ids";

type Kind = "species" | "item" | "ability" | "nature" | "move";

const records = {
  species: gameData.species,
  item: gameData.items,
  ability: gameData.abilities,
  nature: gameData.natures,
  move: gameData.moves,
};

// Game data ids are Showdown ids of the names, so toId(name) finds them.
const byId = Object.fromEntries(
  Object.entries(records).map(([kind, list]) => [
    kind,
    new Map<string, { id: string; name: string }>(
      list.map((record) => [record.id, record]),
    ),
  ]),
) as Record<Kind, Map<string, { id: string; name: string }>>;

const speciesById = new Map(gameData.species.map((s) => [s.id, s]));

/** The id for a name, or null if there's no such thing in the game data. */
export function findId(kind: Kind, name: string): string | null {
  const id = toId(name);
  return byId[kind].has(id) ? id : null;
}

/** The display name for an id. */
export function nameOf(kind: Kind, id: string): string {
  return byId[kind].get(id)?.name ?? id;
}

export function getSpecies(id: string): Species | undefined {
  return speciesById.get(id);
}

/**
 * The species for a name and gender. Some species have a separate female
 * form (Indeedee-F, Meowstic-F), which team sheets write as the base name
 * plus a gender, such as "Indeedee [Female]" or "Indeedee (F)".
 */
export function findSpeciesId(
  name: string,
  gender: "M" | "F" | null,
): string | null {
  const id = findId("species", name);
  if (id && gender === "F" && speciesById.has(`${id}f`)) return `${id}f`;
  return id;
}
