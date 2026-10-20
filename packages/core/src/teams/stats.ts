import type { StatId } from "../game-data/types";

/**
 * A stat in battle, from its base stat, stat points and the nature's
 * effect on it. Champions fixes every Pokémon at level 50 with perfect
 * IVs, where each stat point adds one:
 *
 *   HP = base + points + 75
 *   other = ⌊(base + points + 20) × nature⌋  (1.1 raised, 0.9 lowered)
 *
 * The same as the main games' formula at level 50 with 31 IVs.
 */
export function battleStat(
  stat: StatId,
  base: number,
  points: number,
  nature: { plusStat: StatId | null; minusStat: StatId | null } | null,
): number {
  if (stat === "hp") return base + points + 75;
  const multiplier =
    nature?.plusStat === stat && nature.minusStat !== stat
      ? 1.1
      : nature?.minusStat === stat && nature.plusStat !== stat
        ? 0.9
        : 1;
  // Rounded first, so 1.1 × 110 isn't 120.99999.
  return Math.floor(
    Math.round((base + points + 20) * multiplier * 1000) / 1000,
  );
}
