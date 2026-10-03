import type { StatId } from "../game-data/types";
import type { Regulation } from "../regulation";
import { getSpecies } from "./lookup";
import type { Team } from "./types";

const STATS: StatId[] = ["hp", "atk", "def", "spa", "spd", "spe"];

/**
 * A key that's the same for identical teams, so the same team imported from
 * two events is stored once. Slot order, move order and nicknames don't
 * matter. Battle-only forms count as the form they change from, so RK9's
 * "Salamence @ Salamencite" and a paste's "Salamence-Mega @ Salamencite"
 * match.
 */
export function teamFingerprint(team: Team, regulation: Regulation): string {
  const sets = team.sets.map((set) => {
    const species = set.speciesId ? getSpecies(set.speciesId) : undefined;
    const points = set.statPoints
      ? STATS.map((stat) => set.statPoints![stat]).join(".")
      : "";
    return [
      species?.battleOnlyFromId ?? set.speciesId ?? "",
      set.itemId ?? (set.listedItem ? `listed=${set.listedItem}` : ""),
      set.abilityId ?? "",
      set.natureId ?? "",
      [...set.moveIds].sort().join("+"),
      points,
    ].join(":");
  });
  return [regulation, ...sets.sort()].join("|");
}
