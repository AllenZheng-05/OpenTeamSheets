import type { Regulation } from "../regulation";
import abilities from "../../data/generated/abilities.json";
import items from "../../data/generated/items.json";
import moves from "../../data/generated/moves.json";
import natures from "../../data/generated/natures.json";
import species from "../../data/generated/species.json";
import typeChart from "../../data/generated/type-chart.json";
import types from "../../data/generated/types.json";
import maLearnsets from "../../data/generated/regulations/m-a/learnsets.json";
import maLegality from "../../data/generated/regulations/m-a/legality.json";
import mbLearnsets from "../../data/generated/regulations/m-b/learnsets.json";
import mbLegality from "../../data/generated/regulations/m-b/legality.json";
import mcLearnsets from "../../data/generated/regulations/m-c/learnsets.json";
import mcLegality from "../../data/generated/regulations/m-c/legality.json";
import regulationStatus from "../../data/regulation-status.json";
import type {
  Ability,
  DataStatus,
  Item,
  Learnsets,
  Move,
  Nature,
  PokemonType,
  RegulationLegality,
  Species,
  TypeChart,
} from "./types";

export const gameData = {
  types: types as PokemonType[],
  typeChart: typeChart as TypeChart,
  natures: natures as Nature[],
  species: species as Species[],
  moves: moves as Move[],
  abilities: abilities as Ability[],
  items: items as Item[],
};

export interface RegulationData {
  legality: RegulationLegality;
  learnsets: Learnsets;
}

/** Generated data per regulation. A new regulation has none until it's pulled. */
export const regulationData: Partial<Record<Regulation, RegulationData>> = {
  "M-A": { legality: maLegality, learnsets: maLearnsets },
  "M-B": { legality: mbLegality, learnsets: mbLearnsets },
  "M-C": { legality: mcLegality, learnsets: mcLearnsets },
};

/**
 * How complete a regulation's data is, from data/regulation-status.json.
 * A regulation missing from that file has no data yet.
 */
export function getRegulationDataStatus(regulation: Regulation): DataStatus {
  return (
    (regulationStatus as Partial<Record<string, DataStatus>>)[regulation] ??
    "pending"
  );
}
