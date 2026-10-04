import { gameData } from "@ots/core/game-data";
import type { Species, StatId } from "@ots/core/game-data";
import { getSpecies, itemForm, nameOf, type TeamSet } from "@ots/core/teams";

// What the team page shows about each Pokémon beyond its sheet: its forms
// (the one listed and, holding its Mega Stone, the Mega it becomes), each
// with types, ability and base stats; what its nature raises and lowers;
// and what its item, abilities and moves do.

export const STAT_IDS: StatId[] = ["hp", "atk", "def", "spa", "spd", "spe"];

/** Something with a name and, for hovering, what it does. */
export interface Described {
  name: string;
  description: string | null;
}

export interface MoveView extends Described {
  type: string;
  category: "physical" | "special" | "status";
  power: number;
  /** Null for moves that never miss. */
  accuracy: number | null;
  priority: number;
}

export interface FormView {
  name: string;
  spriteId: string;
  types: string[];
  /** The listed form's chosen ability, or a Mega's own. */
  ability: Described | null;
  stats: Record<StatId, number>;
  total: number;
}

export interface PokemonDetailsView {
  /** The form listed, then the Mega it becomes when it holds its stone. */
  forms: FormView[];
  nature: { name: string; plus: StatId | null; minus: StatId | null } | null;
  item: Described | null;
  /** In the set's order. */
  moves: MoveView[];
}

const byId = <T extends { id: string }>(records: T[]) =>
  new Map(records.map((r) => [r.id, r]));
const moves = byId(gameData.moves);
const abilities = byId(gameData.abilities);
const items = byId(gameData.items);
const natures = byId(gameData.natures);

const described = (
  record: { name: string; description?: string | null } | undefined,
  fallback: string,
): Described => ({
  name: record?.name ?? fallback,
  description: record?.description || null,
});

function formView(species: Species, abilityId: string | null): FormView {
  const stats = Object.fromEntries(
    STAT_IDS.map((stat) => [stat, species[stat]]),
  ) as Record<StatId, number>;
  return {
    name: species.name,
    spriteId: species.spriteId,
    types: [species.type1, species.type2].filter((t): t is string => !!t),
    ability: abilityId
      ? described(abilities.get(abilityId), nameOf("ability", abilityId))
      : null,
    stats,
    total: STAT_IDS.reduce((sum, stat) => sum + stats[stat], 0),
  };
}

/** The team page's details for one set, or null without a known Pokémon. */
export function setDetails(set: TeamSet): PokemonDetailsView | null {
  const listed = set.speciesId ? getSpecies(set.speciesId) : undefined;
  if (!listed) return null;
  // A set may list a Mega itself (as a Showdown paste does); its form
  // outside battle is the one it changes from.
  const base = listed.battleOnlyFromId
    ? (getSpecies(listed.battleOnlyFromId) ?? listed)
    : listed;
  const mega = listed.battleOnlyFromId
    ? listed
    : itemForm(listed.id, set.itemId);

  const nature = set.natureId ? natures.get(set.natureId) : undefined;
  return {
    forms: [
      formView(base, set.abilityId),
      ...(mega ? [formView(mega, mega.ability1)] : []),
    ],
    nature: nature
      ? {
          name: nature.name,
          plus: nature.plusStat,
          minus: nature.minusStat,
        }
      : null,
    item: set.itemId
      ? described(items.get(set.itemId), nameOf("item", set.itemId))
      : set.listedItem
        ? { name: set.listedItem, description: null }
        : null,
    moves: set.moveIds.map((id) => {
      const move = moves.get(id);
      return {
        ...described(move, nameOf("move", id)),
        type: move?.typeId ?? "normal",
        category: move?.category ?? "status",
        power: move?.power ?? 0,
        accuracy: move?.accuracy ?? null,
        priority: move?.priority ?? 0,
      };
    }),
  };
}
