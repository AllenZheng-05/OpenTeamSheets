import type { Filters } from "./search";
import type { Choice } from "./search-query";

// The search bar's chosen filters as pills: which list in Filters each
// belongs in, and back.

export const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

export type ListKey =
  "has" | "not" | "archetypes" | "notArchetypes" | "players" | "notPlayers";

/** A chosen filter, and where it sits in Filters. */
export type Pill = { choice: Choice; list: ListKey; index: number };

/** The list in Filters a choice belongs in. */
export const listFor = (choice: Choice): ListKey =>
  "condition" in choice
    ? choice.mode
    : "archetype" in choice
      ? choice.mode === "has"
        ? "archetypes"
        : "notArchetypes"
      : choice.mode === "has"
        ? "players"
        : "notPlayers";

/** What a choice adds to its list. */
export const valueOf = (choice: Choice) =>
  "condition" in choice
    ? choice.condition
    : "archetype" in choice
      ? choice.archetype
      : choice.player;

/** Every chosen filter, in the order the pills show them. */
export function pillsOf(filters: Filters): Pill[] {
  const pills = (
    list: ListKey,
    values: unknown[],
    choice: (value: never) => Choice,
  ) =>
    values.map((value, index) => ({
      choice: choice(value as never),
      list,
      index,
    }));
  return [
    ...pills("has", filters.has, (condition) => ({ mode: "has", condition })),
    ...pills("not", filters.not, (condition) => ({ mode: "not", condition })),
    ...pills("archetypes", filters.archetypes, (archetype) => ({
      mode: "has",
      archetype,
    })),
    ...pills("notArchetypes", filters.notArchetypes, (archetype) => ({
      mode: "not",
      archetype,
    })),
    ...pills("players", filters.players, (player) => ({
      mode: "has",
      player,
    })),
    ...pills("notPlayers", filters.notPlayers, (player) => ({
      mode: "not",
      player,
    })),
  ];
}
