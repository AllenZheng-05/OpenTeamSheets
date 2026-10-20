import { REGULATIONS, type Regulation } from "../regulation";
import { regulationData } from "../game-data/data";
import type { Species } from "../game-data/types";
import { getSpecies } from "./lookup";

/**
 * The form a set is checked as: a battle-only form (a Mega) is checked as
 * the form it changes from, as the validator and Showdown do.
 */
export function setForm(speciesId: string): Species | undefined {
  const species = getSpecies(speciesId);
  if (!species?.battleOnlyFromId) return species;
  return getSpecies(species.battleOnlyFromId) ?? species;
}

/** The abilities a Pokémon can have, in Showdown's order. */
export function learnableAbilities(speciesId: string): string[] {
  const form = setForm(speciesId);
  if (!form) return [];
  return [form.ability1, form.ability2, form.abilityHidden].filter(
    (a): a is string => a !== null,
  );
}

/**
 * The moves a Pokémon can learn in a regulation. A Pokémon that isn't in
 * the regulation has no learnset there, so its newest learnset from
 * another regulation stands in (the validator reports the Pokémon); one
 * never in any has none.
 */
export function learnableMoves(
  speciesId: string,
  regulation: Regulation,
): string[] {
  const form = setForm(speciesId);
  if (!form) return [];
  const own = regulationData[regulation]?.learnsets[form.id];
  if (own) return own;
  for (const { id } of [...REGULATIONS].reverse()) {
    const other = regulationData[id]?.learnsets[form.id];
    if (other) return other;
  }
  return [];
}
