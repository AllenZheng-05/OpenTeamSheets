import { gameData } from "../game-data/data";
import type { Species } from "../game-data/types";
import { getSpecies } from "./lookup";
import type { Team, TeamSet } from "./types";

// Archetypes that can be read from a team's sets. Playstyle archetypes
// (hyper offense, balance, setup, gimmick) can't be, so authors choose them.
// Ids that aren't in Champions yet (Misty Surge, Arena Trap) are kept so the
// rules still work if a regulation adds them.

interface Rule {
  archetype: string;
  abilities?: string[];
  moves?: string[];
}

const RULES: Rule[] = [
  {
    archetype: "sun",
    abilities: ["drought", "orichalcumpulse"],
    moves: ["sunnyday"],
  },
  { archetype: "rain", abilities: ["drizzle"], moves: ["raindance"] },
  { archetype: "sand", abilities: ["sandstream"], moves: ["sandstorm"] },
  {
    archetype: "snow",
    abilities: ["snowwarning"],
    moves: ["snowscape", "chillyreception"],
  },
  {
    archetype: "psychic-terrain",
    abilities: ["psychicsurge"],
    moves: ["psychicterrain"],
  },
  {
    archetype: "grassy-terrain",
    abilities: ["grassysurge"],
    moves: ["grassyterrain"],
  },
  {
    archetype: "electric-terrain",
    abilities: ["electricsurge", "hadronengine"],
    moves: ["electricterrain"],
  },
  {
    archetype: "misty-terrain",
    abilities: ["mistysurge"],
    moves: ["mistyterrain"],
  },
  { archetype: "trick-room", moves: ["trickroom"] },
  { archetype: "tailwind", moves: ["tailwind"] },
];

// Perish Trap needs Perish Song and a way to stop the target switching out.
const PERISH_SONG = "perishsong";
const TRAPPING_ABILITIES = ["shadowtag", "arenatrap"];
const TRAPPING_MOVES = [
  "meanlook",
  "block",
  "spiritshackle",
  "anchorshot",
  "jawlock",
];

// Battle-only forms by the item that makes them (Charizardite Y -> Mega Charizard Y).
const formsByItem = new Map<string, Species[]>();
for (const species of gameData.species) {
  if (species.battleOnlyFromId && species.requiredItemId) {
    const forms = formsByItem.get(species.requiredItemId) ?? [];
    forms.push(species);
    formsByItem.set(species.requiredItemId, forms);
  }
}

/**
 * The abilities a set can have in battle: the listed one, plus a Mega's.
 * Team sheets list the ability before Mega Evolving, so Charizard holding
 * Charizardite Y has Drought once it Mega Evolves.
 */
function battleAbilities(set: TeamSet): string[] {
  const abilities = set.abilityId ? [set.abilityId] : [];
  const species = set.speciesId ? getSpecies(set.speciesId) : undefined;
  if (!species) return abilities;
  const outOfBattle = species.battleOnlyFromId ?? species.id;
  const forms = formsByItem.get(set.itemId ?? "") ?? [];
  for (const form of forms) {
    if (form.battleOnlyFromId === outOfBattle && form.ability1) {
      abilities.push(form.ability1);
    }
  }
  return abilities;
}

/** The archetypes a team plays, in the order of RULES, then Perish Trap. */
export function deriveArchetypes(team: Team): string[] {
  const abilities = new Set(team.sets.flatMap(battleAbilities));
  const moves = new Set(team.sets.flatMap((set) => set.moveIds));
  const has = (ids: string[] | undefined, found: Set<string>) =>
    (ids ?? []).some((id) => found.has(id));

  const archetypes = RULES.filter(
    (rule) => has(rule.abilities, abilities) || has(rule.moves, moves),
  ).map((rule) => rule.archetype);
  if (
    moves.has(PERISH_SONG) &&
    (has(TRAPPING_ABILITIES, abilities) || has(TRAPPING_MOVES, moves))
  ) {
    archetypes.push("perish-trap");
  }
  return archetypes;
}
