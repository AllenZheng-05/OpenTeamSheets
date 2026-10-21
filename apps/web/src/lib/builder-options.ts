import type { Regulation } from "@ots/core";
import { gameData, regulationData, type Move } from "@ots/core/game-data";
import { learnableAbilities } from "@ots/core/teams";
import type { ComboboxOption } from "@/components/combobox";
import { fold } from "./search-query";

// The builder's field lists, from core's game data, each option with what
// it does: shown when it's expanded in the list, and under the field
// holding it.

export interface FieldOption extends ComboboxOption {
  id: string;
  /** What it does. */
  info?: { facts?: string; description: string | null };
  /** A move's basic info, always shown in the list. */
  move?: MoveBasics;
  /** A Pokémon's row in the list, as in Showdown's teambuilder. */
  species?: SpeciesRow;
}

export interface MoveBasics {
  type: string;
  category: Move["category"];
  /** 0 for status moves. */
  power: number;
  /** Null for moves that never miss. */
  accuracy: number | null;
  priority: number;
}

export interface SpeciesRow {
  spriteId: string;
  types: string[];
  /** Ability names; the hidden one, if any, is `hidden`. */
  abilities: string[];
  hidden: string | null;
  /** HP, Atk, Def, SpA, SpD, Spe. */
  stats: number[];
  total: number;
}

const STAT_SHORT = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
} as const;

const typeNames = new Map(gameData.types.map((t) => [t.id, t.name]));
const abilityNames = new Map(gameData.abilities.map((a) => [a.id, a.name]));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A Mega: a battle-only form made by holding an item, its Mega Stone. */
const isMega = (s: {
  battleOnlyFromId: string | null;
  requiredItemId: string | null;
}) => !!s.battleOnlyFromId && !!s.requiredItemId;

/**
 * What picking a Pokémon from the list changes: a Mega is its base form
 * holding its stone. The ability stays if the Pokémon can have it, else
 * becomes its first.
 */
export function speciesChoice(
  id: string,
  currentAbility: string | null,
): {
  speciesId: string;
  abilityId: string | null;
  itemId?: string;
  listedItem?: null;
} {
  const species = gameData.species.find((s) => s.id === id);
  const mega = species && isMega(species) ? species : undefined;
  const speciesId = mega ? mega.battleOnlyFromId! : id;
  const abilities = learnableAbilities(speciesId);
  return {
    speciesId,
    abilityId:
      currentAbility && abilities.includes(currentAbility)
        ? currentAbility
        : (abilities[0] ?? null),
    ...(mega && { itemId: mega.requiredItemId!, listedItem: null }),
  };
}

/** A move's type, category, power, accuracy and priority. */
export function moveFacts(move: Move): string {
  return [
    typeNames.get(move.typeId) ?? capitalize(move.typeId),
    capitalize(move.category),
    move.power ? `${move.power} power` : null,
    move.accuracy === null ? "never misses" : `${move.accuracy}% accuracy`,
    move.priority
      ? `priority ${move.priority > 0 ? "+" : ""}${move.priority}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name);

/** Options with their descriptions. */
const described = (
  list: { id: string; name: string; description: string }[],
): FieldOption[] =>
  [...list].sort(byName).map(({ id, name, description }) => ({
    key: id,
    id,
    name,
    info: { description: description || null },
  }));

let built: Record<FieldKind, FieldOption[]> | undefined;

export type FieldKind = "species" | "item" | "ability" | "move" | "nature";

/** Every option for a field, by name. */
export function fieldOptions(kind: FieldKind): FieldOption[] {
  built ??= {
    // Pokémon, and Megas (picked as their base form holding the stone, as
    // team sheets list them). Other battle-only forms aren't chosen.
    species: gameData.species
      .filter((s) => !s.battleOnlyFromId || isMega(s))
      .sort(byName)
      .map((s) => {
        const stats = [s.hp, s.atk, s.def, s.spa, s.spd, s.spe];
        const name = (id: string | null) =>
          id ? (abilityNames.get(id) ?? id) : null;
        return {
          key: s.id,
          id: s.id,
          name: s.name,
          species: {
            spriteId: s.spriteId,
            types: [s.type1, s.type2].filter((t): t is string => t !== null),
            abilities: [name(s.ability1), name(s.ability2)].filter(
              (a): a is string => a !== null,
            ),
            hidden: name(s.abilityHidden),
            stats,
            total: stats.reduce((sum, n) => sum + n, 0),
          },
        };
      }),
    item: described(gameData.items),
    ability: described(gameData.abilities),
    move: [...gameData.moves].sort(byName).map((m) => ({
      key: m.id,
      id: m.id,
      name: m.name,
      info: { facts: moveFacts(m), description: m.description || null },
      move: {
        type: m.typeId,
        category: m.category,
        power: m.power,
        accuracy: m.accuracy,
        priority: m.priority,
      },
    })),
    nature: [...gameData.natures].sort(byName).map((n) => ({
      key: n.id,
      id: n.id,
      text: n.name,
      name:
        n.plusStat && n.minusStat
          ? `${n.name} (+${STAT_SHORT[n.plusStat]}, −${STAT_SHORT[n.minusStat]})`
          : `${n.name} (neutral)`,
    })),
  };
  return built[kind];
}

/**
 * The options matching typed text: names starting with it first, then
 * names containing it, ignoring case and accents. Empty text lists all.
 */
export function matchOptions(
  list: FieldOption[],
  query: string,
): FieldOption[] {
  const q = fold(query.trim());
  if (!q) return list;
  const starts: FieldOption[] = [];
  const contains: FieldOption[] = [];
  for (const option of list) {
    const name = fold(option.text ?? option.name);
    if (name.startsWith(q)) starts.push(option);
    else if (name.includes(q)) contains.push(option);
  }
  return [...starts, ...contains];
}

const speciesById = new Map(gameData.species.map((s) => [s.id, s]));

/** What's legal in each regulation, by id, or null before its rules are out. */
const legalByRegulation = new Map<
  Regulation,
  { species: Set<string>; items: Set<string> } | null
>();

function legal(regulation: Regulation) {
  if (!legalByRegulation.has(regulation)) {
    const data = regulationData[regulation]?.legality;
    legalByRegulation.set(
      regulation,
      data
        ? { species: new Set(data.species), items: new Set(data.items) }
        : null,
    );
  }
  return legalByRegulation.get(regulation)!;
}

const speciesByRegulation = new Map<Regulation, FieldOption[]>();

/**
 * The Pokémon legal in a regulation, by name. A Mega is legal when its
 * base form and its stone are, as the validator decides. Before a
 * regulation's rules are out, every Pokémon.
 */
export function speciesOptions(regulation: Regulation): FieldOption[] {
  let options = speciesByRegulation.get(regulation);
  if (!options) {
    const rules = legal(regulation);
    options = rules
      ? fieldOptions("species").filter((o) => {
          const s = speciesById.get(o.id);
          if (s && isMega(s)) {
            return (
              rules.species.has(s.battleOnlyFromId!) &&
              rules.items.has(s.requiredItemId!)
            );
          }
          return rules.species.has(o.id);
        })
      : fieldOptions("species");
    speciesByRegulation.set(regulation, options);
  }
  return options;
}

const itemsByRegulation = new Map<Regulation, FieldOption[]>();

/** The items legal in a regulation, by name; every item before its rules are out. */
export function itemOptions(regulation: Regulation): FieldOption[] {
  let options = itemsByRegulation.get(regulation);
  if (!options) {
    const rules = legal(regulation);
    options = rules
      ? fieldOptions("item").filter((o) => rules.items.has(o.id))
      : fieldOptions("item");
    itemsByRegulation.set(regulation, options);
  }
  return options;
}

/** Abilities and moves matched per search, so the list stays short. */
const MATCHES_PER_KIND = 3;

/** Which Pokémon learn each move, per regulation (built when first asked). */
const learnersByRegulation = new Map<Regulation, Map<string, string[]>>();

function learners(regulation: Regulation): Map<string, string[]> {
  let map = learnersByRegulation.get(regulation);
  if (map) return map;
  map = new Map();
  const choosable = new Set(fieldOptions("species").map((o) => o.id));
  for (const [speciesId, moves] of Object.entries(
    regulationData[regulation]?.learnsets ?? {},
  )) {
    if (!choosable.has(speciesId)) continue;
    for (const move of moves) {
      const list = map.get(move) ?? [];
      list.push(speciesId);
      map.set(move, list);
    }
  }
  learnersByRegulation.set(regulation, map);
  return map;
}

/**
 * Pokémon for an empty slot, found by name, or by an ability they can have
 * or a move they learn in the regulation: typing "intimidate" lists the
 * Pokémon with Intimidate, "fake out" those that learn Fake Out. Matches
 * by ability or move are grouped under it, after the matches by name.
 */
export function searchSpecies(
  query: string,
  regulation: Regulation,
): FieldOption[] {
  const species = speciesOptions(regulation);
  const named = matchOptions(species, query);
  if (fold(query.trim()).length < 2) return named;

  const byId = new Map(species.map((o) => [o.id, o]));
  const grouped = (
    kind: "ability" | "move",
    match: FieldOption,
    ids: string[],
    group: string,
  ) =>
    ids
      .flatMap((id) => byId.get(id) ?? [])
      .sort(byName)
      .map((o) => ({
        ...o,
        key: `${kind}:${match.id}:${o.id}`,
        group,
        // The tip says what the ability or move does.
        info: match.info,
      }));

  const abilities = matchOptions(fieldOptions("ability"), query)
    .slice(0, MATCHES_PER_KIND)
    .flatMap((ability) =>
      grouped(
        "ability",
        ability,
        gameData.species
          .filter(
            (s) =>
              (!s.battleOnlyFromId || isMega(s)) &&
              [s.ability1, s.ability2, s.abilityHidden].includes(ability.id),
          )
          .map((s) => s.id),
        `With ${ability.name}`,
      ),
    );
  const moves = matchOptions(fieldOptions("move"), query)
    .slice(0, MATCHES_PER_KIND)
    .flatMap((move) =>
      grouped(
        "move",
        move,
        learners(regulation).get(move.id) ?? [],
        `Learns ${move.name}`,
      ),
    );
  if (abilities.length === 0 && moves.length === 0) return named;
  return [
    ...named.map((o) => ({ ...o, group: "Pokémon" })),
    ...abilities,
    ...moves,
  ];
}
