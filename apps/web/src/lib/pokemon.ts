import type { Tables } from "@ots/core/db";
import { gameData } from "@ots/core/game-data";
import type { SheetError, StatTable, TeamSet } from "@ots/core/teams";
import { boxSpecies, displaySpecies, nameOf } from "@ots/core/teams";
import type { PokemonDetailsView } from "./pokemon-details";

const itemSprites = new Map(
  gameData.items.map((item) => [item.id, item.spriteNum]),
);

/**
 * An error on an official team sheet as published (a typo when it was
 * entered), marked on the listed ability or move.
 */
export interface SheetMark {
  message: string;
  /**
   * What it probably meant, from our reviewed readings ("Last Respects"),
   * or "left blank"; never applied.
   */
  reading: string | null;
}

/** One Pokémon as the site shows it, with names resolved on the server. */
export interface PokemonView {
  slot: number;
  name: string;
  /** The Pokémon a player owns to use it (core's boxSpecies). */
  boxSpecies: string | null;
  /** The Showdown sprite id of the form shown. */
  spriteId: string | null;
  shiny: boolean;
  types: string[];
  /** The item's name, or as listed when it isn't in the game. */
  item: string | null;
  itemMark: SheetMark | null;
  /** The item's position in Showdown's item sprite sheet. */
  itemSpriteNum: number | null;
  ability: string | null;
  abilityMark: SheetMark | null;
  nature: string | null;
  moves: string[];
  /** Marks for the moves, in the same order. */
  moveMarks: (SheetMark | null)[];
  statPoints: StatTable | null;
  /** Forms, base stats and descriptions, for the team page only. */
  details?: PokemonDetailsView | null;
}

const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

/** A `team_sets` row as a core TeamSet. */
export function setFromRow(row: Tables<"team_sets">): TeamSet {
  const points = STATS.map((stat) => row[`sp_${stat}`]);
  return {
    nickname: null,
    speciesId: row.species_id,
    itemId: row.item_id,
    listedItem: row.listed_item,
    abilityId: row.ability_id,
    natureId: row.nature_id,
    moveIds: [
      row.move_1_id,
      row.move_2_id,
      row.move_3_id,
      row.move_4_id,
    ].filter((move): move is string => move !== null),
    // Stat points are all known or all unknown (official team sheets).
    statPoints: points.every((value) => value === null)
      ? null
      : (Object.fromEntries(
          STATS.map((stat, i) => [stat, points[i] ?? 0]),
        ) as StatTable),
    level: row.level,
    ivs: Object.fromEntries(
      STATS.map((stat) => [stat, row[`iv_${stat}`]]),
    ) as StatTable,
    shiny: row.shiny,
  };
}

/**
 * What the site shows for a set: the Mega when it holds its stone, and
 * this set's sheet errors (from sheetErrors) on what they're about.
 */
export function pokemonView(
  set: TeamSet,
  slot: number,
  errors: SheetError[] = [],
): PokemonView {
  const shown = displaySpecies(set);
  const mark = (field: "item" | "ability" | "move", value: string | null) => {
    const error = errors.find((e) => e.field === field && e.value === value);
    return error
      ? {
          message: error.message,
          reading: error.reading ?? (error.leftBlank ? "left blank" : null),
        }
      : null;
  };
  return {
    slot,
    name: shown?.name ?? "Unknown Pokémon",
    boxSpecies: set.speciesId ? boxSpecies(set.speciesId) : null,
    spriteId: shown?.spriteId ?? null,
    shiny: set.shiny,
    types: shown
      ? [shown.type1, shown.type2].filter((t): t is string => t !== null)
      : [],
    item: set.itemId ? nameOf("item", set.itemId) : (set.listedItem ?? null),
    itemMark: mark("item", set.listedItem ?? null),
    itemSpriteNum: set.itemId ? (itemSprites.get(set.itemId) ?? null) : null,
    ability: set.abilityId ? nameOf("ability", set.abilityId) : null,
    abilityMark: mark("ability", set.abilityId),
    nature: set.natureId ? nameOf("nature", set.natureId) : null,
    moves: set.moveIds.map((move) => nameOf("move", move)),
    moveMarks: set.moveIds.map((move) => mark("move", move)),
    statPoints: set.statPoints,
  };
}
