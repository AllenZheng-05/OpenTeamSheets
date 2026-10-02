/**
 * Runs inside one Pokémon Showdown build and prints its Champions data for
 * one format as JSON on stdout. data-pull.ts starts it as a child process,
 * so builds from different commits never share a process.
 *
 * Usage: node --import tsx showdown-export.ts <showdown dir> <format id>
 */
import { createRequire } from "node:module";
import path from "node:path";
import type {
  Ability,
  Item,
  Learnsets,
  Move,
  Nature,
  PokemonType,
  Species,
  StatId,
  TypeChart,
} from "@ots/core/game-data";

// The parts of Showdown's API used here. Showdown ships no types for its
// built output, so these mirror sim/dex-*.ts and sim/team-validator.ts.
interface ShowdownEffect {
  id: string;
  name: string;
  num: number;
  exists: boolean;
}
interface ShowdownSpecies extends ShowdownEffect {
  baseSpecies: string;
  types: string[];
  abilities: Record<string, string | undefined>;
  baseStats: Record<StatId, number>;
  requiredItem?: string;
  requiredAbility?: string;
  requiredMove?: string;
  battleOnly?: string | string[];
}
interface ShowdownMove extends ShowdownEffect {
  type: string;
  category: "Physical" | "Special" | "Status";
  basePower: number;
  accuracy: number | true;
  pp: number;
  priority: number;
  target: string;
}
interface ShowdownNature {
  id: string;
  name: string;
  plus?: StatId;
  minus?: StatId;
}
interface ShowdownType {
  id: string;
  name: string;
  exists: boolean;
  damageTaken: Record<string, number>;
}
interface ShowdownTable<T> {
  get(name: string): T;
  all(): readonly T[];
}
type TextTable = Record<string, { shortDesc?: string; desc?: string }>;
interface ShowdownDex {
  species: ShowdownTable<ShowdownSpecies>;
  moves: ShowdownTable<ShowdownMove>;
  items: ShowdownTable<ShowdownEffect>;
  abilities: ShowdownTable<ShowdownEffect>;
  natures: ShowdownTable<ShowdownNature>;
  types: ShowdownTable<ShowdownType>;
  loadTextData(): Record<"Moves" | "Abilities" | "Items", TextTable>;
}
interface ShowdownSet {
  name: string;
  species: string;
  item: string;
  ability: string;
  moves: string[];
}
interface ShowdownValidator {
  dex: ShowdownDex;
  checkSpecies(
    set: ShowdownSet,
    species: ShowdownSpecies,
    tierSpecies: ShowdownSpecies,
    setHas: Record<string, true>,
  ): string | null;
  checkItem(
    set: ShowdownSet,
    item: ShowdownEffect,
    setHas: Record<string, true>,
  ): string | null;
  checkMove(
    set: ShowdownSet,
    move: ShowdownMove,
    setHas: Record<string, true>,
  ): string | null;
  checkCanLearn(move: ShowdownMove, species: ShowdownSpecies): string | null;
}

export interface ShowdownExport {
  types: PokemonType[];
  typeChart: TypeChart;
  natures: Nature[];
  species: Species[];
  moves: Move[];
  abilities: Ability[];
  items: Item[];
  legalSpecies: string[];
  legalItems: string[];
  learnsets: Learnsets;
}

// Showdown's damageTaken codes: 0 neutral, 1 weak, 2 resists, 3 immune.
const MULTIPLIERS = [1, 2, 0.5, 0] as const;

const byId = <T extends { id: string }>(a: T, b: T) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

function exportFormat(showdownDir: string, formatId: string): ShowdownExport {
  const require = createRequire(path.join(showdownDir, "package.json"));
  const sim = require("./dist/sim") as {
    TeamValidator: { get(format: string): ShowdownValidator };
  };
  const validator = sim.TeamValidator.get(formatId);
  const dex = validator.dex;
  const text = dex.loadTextData();

  const setFor = (species: ShowdownSpecies): ShowdownSet => ({
    name: species.name,
    species: species.name,
    item: species.requiredItem ?? "",
    ability: "",
    moves: [],
  });

  // The validator also accepts forms that only exist mid-battle (Megas,
  // Mimikyu-Busted). They're exported as species, but only forms that can
  // be put on a team are legal.
  const validSpecies = dex.species
    .all()
    .filter(
      (species) =>
        species.exists &&
        validator.checkSpecies(setFor(species), species, species, {}) === null,
    )
    .sort(byId);
  const legalSpecies = validSpecies.filter((species) => !species.battleOnly);
  // A form that several forms can change into lists them all; the first is
  // enough to link it to a selectable form. No Champions form has several.
  const battleOnlyFrom = (species: ShowdownSpecies) =>
    species.battleOnly
      ? dex.species.get(
          Array.isArray(species.battleOnly)
            ? species.battleOnly[0]!
            : species.battleOnly,
        )
      : null;

  const anySet = setFor(legalSpecies[0]!);
  const legalItems = dex.items
    .all()
    .filter(
      (item) => item.exists && validator.checkItem(anySet, item, {}) === null,
    )
    .sort(byId);
  const legalMoves = dex.moves
    .all()
    .filter(
      (move) => move.exists && validator.checkMove(anySet, move, {}) === null,
    )
    .sort(byId);

  const learnsets: Learnsets = {};
  for (const species of legalSpecies) {
    learnsets[species.id] = legalMoves
      .filter((move) => validator.checkCanLearn(move, species) === null)
      .map((move) => move.id);
  }

  // Everything the valid species and items refer to, so every reference resolves.
  const speciesById = new Map(validSpecies.map((s) => [s.id, s]));
  for (const species of validSpecies) {
    for (const related of [
      dex.species.get(species.baseSpecies),
      battleOnlyFrom(species),
    ]) {
      if (related?.exists) speciesById.set(related.id, related);
    }
  }
  const itemIds = new Set(legalItems.map((item) => item.id));
  const abilityIds = new Set<string>();
  for (const species of speciesById.values()) {
    if (species.requiredItem) {
      itemIds.add(dex.items.get(species.requiredItem).id);
    }
    for (const ability of [
      ...Object.values(species.abilities),
      species.requiredAbility,
    ]) {
      if (ability) abilityIds.add(dex.abilities.get(ability).id);
    }
  }
  const moveIds = new Set(Object.values(learnsets).flat());
  for (const species of speciesById.values()) {
    if (species.requiredMove)
      moveIds.add(dex.moves.get(species.requiredMove).id);
  }

  const abilityId = (name: string | undefined) =>
    name ? dex.abilities.get(name).id : null;
  const description = (table: TextTable, id: string) =>
    table[id]?.shortDesc ?? table[id]?.desc ?? "";

  // Stellar only exists for Terastallization, which Champions doesn't have.
  const types = dex.types
    .all()
    .filter((type) => type.exists && type.name !== "Stellar")
    .sort(byId);
  const typeChart: TypeChart = {};
  for (const attacker of types) {
    typeChart[attacker.id] = {};
    for (const defender of types) {
      typeChart[attacker.id]![defender.id] =
        MULTIPLIERS[defender.damageTaken[attacker.name] ?? 0]!;
    }
  }

  return {
    types: types.map((type) => ({ id: type.id, name: type.name })),
    typeChart,
    natures: dex.natures
      .all()
      .map((nature) => ({
        id: nature.id,
        name: nature.name,
        plusStat: nature.plus ?? null,
        minusStat: nature.minus ?? null,
      }))
      .sort(byId),
    species: [...speciesById.values()].sort(byId).map((species) => ({
      id: species.id,
      num: species.num,
      name: species.name,
      baseSpeciesId:
        species.baseSpecies === species.name
          ? null
          : dex.species.get(species.baseSpecies).id,
      battleOnlyFromId: battleOnlyFrom(species)?.id ?? null,
      type1: dex.types.get(species.types[0]!).id,
      type2: species.types[1] ? dex.types.get(species.types[1]).id : null,
      ability1: abilityId(species.abilities["0"]),
      ability2: abilityId(species.abilities["1"]),
      abilityHidden: abilityId(species.abilities["H"]),
      ...species.baseStats,
      requiredItemId: species.requiredItem
        ? dex.items.get(species.requiredItem).id
        : null,
      requiredAbilityId: abilityId(species.requiredAbility),
      requiredMoveId: species.requiredMove
        ? dex.moves.get(species.requiredMove).id
        : null,
    })),
    moves: [...moveIds].sort().map((id) => {
      const move = dex.moves.get(id);
      return {
        id: move.id,
        num: move.num,
        name: move.name,
        typeId: dex.types.get(move.type).id,
        category: move.category.toLowerCase() as Move["category"],
        power: move.basePower,
        accuracy: move.accuracy === true ? null : move.accuracy,
        pp: move.pp,
        priority: move.priority,
        target: move.target,
        description: description(text.Moves, move.id),
      };
    }),
    abilities: [...abilityIds].sort().map((id) => {
      const ability = dex.abilities.get(id);
      return {
        id: ability.id,
        num: ability.num,
        name: ability.name,
        description: description(text.Abilities, ability.id),
      };
    }),
    items: [...itemIds].sort().map((id) => {
      const item = dex.items.get(id);
      return {
        id: item.id,
        num: item.num,
        name: item.name,
        description: description(text.Items, item.id),
      };
    }),
    legalSpecies: legalSpecies.map((species) => species.id),
    legalItems: legalItems.map((item) => item.id),
    learnsets,
  };
}

const [showdownDir, formatId] = process.argv.slice(2);
if (!showdownDir || !formatId) {
  console.error("Usage: showdown-export.ts <showdown dir> <format id>");
  process.exit(1);
}
process.stdout.write(
  JSON.stringify(exportFormat(path.resolve(showdownDir), formatId)),
);
