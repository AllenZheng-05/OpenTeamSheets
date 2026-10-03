import type { StatId } from "../game-data/types";

/** A number per stat, for stat points and IVs. */
export type StatTable = Record<StatId, number>;

/** Champions sets every Pokémon to level 50 with perfect IVs. */
export const DEFAULT_LEVEL = 50;
export const MAX_IV = 31;

/**
 * One Pokémon on a team, in the shape of a `team_sets` row. Game fields are
 * nullable, so drafts can be incomplete; the validator decides what a
 * finished team needs. Ids are game data ids.
 */
export interface TeamSet {
  nickname: string | null;
  /** May be a battle-only form such as a Mega, as in Showdown. */
  speciesId: string | null;
  itemId: string | null;
  /**
   * An item an official team sheet lists that isn't in the game (Choice
   * Band), as written; itemId is then null. Only imported sheets have one.
   */
  listedItem?: string | null;
  abilityId: string | null;
  natureId: string | null;
  /** Up to four, in order. */
  moveIds: string[];
  /** Null when unknown, as on official team sheets. */
  statPoints: StatTable | null;
  /**
   * Level (1–100) and IVs (0–31) don't change anything in Champions, which
   * sets them to 50 and 31. They're kept so teams export to formats that
   * use them, such as Showdown.
   */
  level: number;
  ivs: StatTable;
  /** Shown with the shiny sprite. */
  shiny: boolean;
}

export interface Team {
  sets: TeamSet[];
}

/** Something wrong with a team, tied to a slot (1–6) when there is one. */
export interface Problem {
  slot: number | null;
  message: string;
  /** For parse problems, the line of the pasted text (1-based). */
  line?: number;
  /** For an illegal item, ability or move, which one. */
  field?: "item" | "ability" | "move";
  /** Its id, or for an item that isn't in the game, its name as listed. */
  value?: string;
}

export interface ParseResult {
  team: Team;
  /** Lines that couldn't be read. Their fields are left empty. */
  errors: Problem[];
}

export const perfectIvs = (): StatTable => ({
  hp: MAX_IV,
  atk: MAX_IV,
  def: MAX_IV,
  spa: MAX_IV,
  spd: MAX_IV,
  spe: MAX_IV,
});

export const emptySet = (): TeamSet => ({
  nickname: null,
  speciesId: null,
  itemId: null,
  abilityId: null,
  natureId: null,
  moveIds: [],
  statPoints: null,
  level: DEFAULT_LEVEL,
  ivs: perfectIvs(),
  shiny: false,
});
