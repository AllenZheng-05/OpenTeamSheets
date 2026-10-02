/**
 * Champions game data, generated from Pokémon Showdown by `pnpm data:pull`.
 * Ids follow Showdown's convention: lowercase letters and digits only
 * ("charizardmegay", "heatwave").
 */

export type StatId = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

export interface PokemonType {
  id: string;
  name: string;
}

/** Damage multiplier for each attacking type against each defending type. */
export type TypeChart = Record<string, Record<string, 0 | 0.5 | 1 | 2>>;

export interface Species {
  id: string;
  /** National Pokédex number, shared by every form of a species. */
  num: number;
  name: string;
  /** The base form this is a form of (Charizard for Mega Charizard Y). */
  baseSpeciesId: string | null;
  /**
   * For forms that only exist mid-battle (Megas, Mimikyu-Busted),
   * battleOnlyFromId is the form it changes from. Like in Showdown,
   * a team slot may have a battle-only form (Mega Charizard Y in team builder)
   * but it's validated as this form, and only this form is on a regulation's
   * legal list. Null for other forms.
   */
  battleOnlyFromId: string | null;
  type1: string;
  type2: string | null;
  ability1: string | null;
  ability2: string | null;
  abilityHidden: string | null;
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  /** The item needed to be in this form, such as a mega stone. */
  requiredItemId: string | null;
}

export type MoveCategory = "physical" | "special" | "status";

export interface Move {
  id: string;
  num: number;
  name: string;
  typeId: string;
  category: MoveCategory;
  power: number;
  /** Null for moves that never miss. */
  accuracy: number | null;
  pp: number;
  priority: number;
  target: string;
  description: string;
}

export interface Ability {
  id: string;
  num: number;
  name: string;
  description: string;
}

export interface Item {
  id: string;
  num: number;
  name: string;
  description: string;
}

export interface Nature {
  id: string;
  name: string;
  /** Null for neutral natures. */
  plusStat: StatId | null;
  minusStat: StatId | null;
}

/** What is legal in one regulation. */
export interface RegulationLegality {
  showdownCommit: string;
  species: string[];
  items: string[];
}

/** Species id to the ids of the moves it can learn in one regulation. */
export type Learnsets = Record<string, string[]>;

export type DataStatus = "pending" | "partial" | "complete";
