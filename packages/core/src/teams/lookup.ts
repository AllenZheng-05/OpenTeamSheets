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

// Battle-only forms by the item that makes them (Charizardite Y -> Mega Charizard Y).
const formsByItem = new Map<string, Species[]>();
for (const species of gameData.species) {
  if (species.battleOnlyFromId && species.requiredItemId) {
    const forms = formsByItem.get(species.requiredItemId) ?? [];
    forms.push(species);
    formsByItem.set(species.requiredItemId, forms);
  }
}

/**
 * The form a Pokémon becomes by holding an item: Mega Charizard Y for
 * Charizard holding Charizardite Y. Undefined if the item doesn't change it.
 */
export function itemForm(
  speciesId: string,
  itemId: string | null,
): Species | undefined {
  const species = speciesById.get(speciesId);
  if (!species || !itemId) return undefined;
  const outOfBattle = species.battleOnlyFromId ?? species.id;
  return formsByItem
    .get(itemId)
    ?.find((form) => form.battleOnlyFromId === outOfBattle);
}

/**
 * The species to show for a set: its Mega when it holds its Mega Stone
 * (official team sheets list the base form), otherwise the listed species.
 */
export function displaySpecies(set: {
  speciesId: string | null;
  itemId: string | null;
}): Species | undefined {
  if (!set.speciesId) return undefined;
  return itemForm(set.speciesId, set.itemId) ?? speciesById.get(set.speciesId);
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
