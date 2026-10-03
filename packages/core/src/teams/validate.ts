import { getRegulationDataStatus, regulationData } from "../game-data/data";
import type { StatId } from "../game-data/types";
import type { Regulation } from "../regulation";
import { getSpecies, nameOf } from "./lookup";
import type { Problem, Team } from "./types";

// The Champions rules of Pokémon Showdown's team validator
// (sim/team-validator.ts): Flat Rules, level 50, Species Clause, Item
// Clause, and at most 32 stat points per stat and 66 in total. Parity with
// Showdown is tested against verdicts from its own validator
// (__fixtures__/validator).

export const MAX_STAT_POINTS = 32;
export const MAX_TOTAL_STAT_POINTS = 66;

const STAT_LABELS: Record<StatId, string> = {
  hp: "HP",
  atk: "Attack",
  def: "Defense",
  spa: "Special Attack",
  spd: "Special Defense",
  spe: "Speed",
};

export interface ValidationResult {
  errors: Problem[];
  warnings: Problem[];
}

export interface ValidateOptions {
  /**
   * Require a finished team: six Pokémon, each with an ability, a nature
   * and a move. True for imports and publishing; false for drafts.
   */
  complete: boolean;
}

export function validateTeam(
  team: Team,
  regulation: Regulation,
  { complete }: ValidateOptions,
): ValidationResult {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  const data = regulationData[regulation];
  // Until a regulation's data is checked, what's legal in it is uncertain,
  // so legality problems are warnings rather than errors.
  const legalityProblems =
    getRegulationDataStatus(regulation) === "complete" ? errors : warnings;
  const legalSpecies = new Set(data?.legality.species);
  const legalItems = new Set(data?.legality.items);

  if (!data) {
    warnings.push({
      slot: null,
      message: `Reg ${regulation}'s rules aren't available yet, so legality wasn't checked`,
    });
  }
  if (complete && team.sets.length !== 6) {
    errors.push({ slot: null, message: "A team needs six Pokémon" });
  }

  team.sets.forEach((set, index) => {
    const slot = index + 1;
    const error = (message: string, about?: Pick<Problem, "field" | "value">) =>
      errors.push({ slot, message, ...about });
    const illegal = (
      message: string,
      about?: Pick<Problem, "field" | "value">,
    ) => legalityProblems.push({ slot, message, ...about });

    if (!set.speciesId) {
      if (complete) error("Choose a Pokémon");
      return;
    }
    const species = getSpecies(set.speciesId);
    if (!species) {
      error(`Unknown Pokémon "${set.speciesId}"`);
      return;
    }

    if (set.listedItem) {
      error(`${set.listedItem} isn't in Pokémon Champions`, {
        field: "item",
        value: set.listedItem,
      });
    }

    // As in Showdown, a battle-only form (a Mega) needs what makes it
    // transform, then the set is checked as the form it changes from.
    const form = species.battleOnlyFromId
      ? (getSpecies(species.battleOnlyFromId) ?? species)
      : species;
    if (species.requiredItemId && set.itemId !== species.requiredItemId) {
      illegal(
        `${species.name} must hold ${nameOf("item", species.requiredItemId)}`,
      );
    }
    if (
      species.requiredAbilityId &&
      set.abilityId !== species.requiredAbilityId
    ) {
      illegal(
        `${species.name} needs the ability ${nameOf("ability", species.requiredAbilityId)}`,
      );
    }
    if (
      species.requiredMoveId &&
      !set.moveIds.includes(species.requiredMoveId)
    ) {
      illegal(
        `${species.name} needs the move ${nameOf("move", species.requiredMoveId)}`,
      );
    }

    if (data) {
      if (set.itemId && !legalItems.has(set.itemId)) {
        illegal(
          `${nameOf("item", set.itemId)} isn't legal in Reg ${regulation}`,
        );
      }
      // An illegal Pokémon has no learnset in the regulation, so its moves
      // and ability can't be checked; the one problem is the Pokémon.
      if (!legalSpecies.has(form.id)) {
        illegal(`${form.name} isn't legal in Reg ${regulation}`);
      } else {
        const abilities = [form.ability1, form.ability2, form.abilityHidden];
        if (set.abilityId && !abilities.includes(set.abilityId)) {
          illegal(
            `${form.name} can't have ${nameOf("ability", set.abilityId)}`,
            { field: "ability", value: set.abilityId },
          );
        }
        const learnset = data.learnsets[form.id] ?? [];
        for (const move of set.moveIds) {
          if (!learnset.includes(move)) {
            illegal(`${form.name} can't learn ${nameOf("move", move)}`, {
              field: "move",
              value: move,
            });
          }
        }
      }
    }

    if (set.moveIds.length > 4) error("A Pokémon has at most four moves");
    if (new Set(set.moveIds).size !== set.moveIds.length) {
      error(`${species.name} has the same move twice`);
    }
    if (complete) {
      if (!set.abilityId) error("Choose an ability");
      if (!set.natureId) error("Choose a nature");
      if (set.moveIds.length === 0) error("Choose at least one move");
    }

    if (set.statPoints) {
      for (const [stat, value] of Object.entries(set.statPoints)) {
        if (value < 0 || value > MAX_STAT_POINTS) {
          error(
            `${species.name} has ${value} stat points in ${STAT_LABELS[stat as StatId]}; the limit is ${MAX_STAT_POINTS}`,
          );
        }
      }
      const total = Object.values(set.statPoints).reduce(
        (sum, value) => sum + value,
        0,
      );
      if (total > MAX_TOTAL_STAT_POINTS) {
        error(
          `${species.name} has ${total} stat points; the limit is ${MAX_TOTAL_STAT_POINTS}`,
        );
      }
    }
  });

  // Species Clause: one of each Pokédex number (so not Charizard and Mega
  // Charizard Y). Item Clause: one of each item.
  const seenSpecies = new Map<number, string>();
  const seenItems = new Set<string>();
  team.sets.forEach((set, index) => {
    const species = set.speciesId ? getSpecies(set.speciesId) : undefined;
    if (species) {
      const baseName =
        getSpecies(species.baseSpeciesId ?? species.id)?.name ?? species.name;
      if (seenSpecies.has(species.num)) {
        errors.push({
          slot: index + 1,
          message: `A team can have only one ${baseName}`,
        });
      }
      seenSpecies.set(species.num, baseName);
    }
    if (set.itemId) {
      if (seenItems.has(set.itemId)) {
        errors.push({
          slot: index + 1,
          message: `Only one Pokémon can hold ${nameOf("item", set.itemId)}`,
        });
      }
      seenItems.add(set.itemId);
    }
  });

  return { errors, warnings };
}
