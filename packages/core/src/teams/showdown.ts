import type { StatId } from "../game-data/types";
import { findId, findSpeciesId, nameOf } from "./lookup";
import {
  emptySet,
  MAX_IV,
  perfectIvs,
  type ParseResult,
  type Problem,
  type StatTable,
  type Team,
  type TeamSet,
} from "./types";

// Follows the format of Pokémon Showdown's paste import and export
// (sim/teams.ts). In Champions, the `EVs:` line holds stat points.

const STAT_NAMES: Record<string, StatId> = {
  hp: "hp",
  atk: "atk",
  def: "def",
  spa: "spa",
  spd: "spd",
  spe: "spe",
};
const STAT_LABELS: Record<StatId, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

// Lines Showdown writes that don't apply to Champions or that we don't store.
const IGNORED =
  /^(Tera Type|Happiness|Pokeball|Dynamax Level|Gigantamax|Hidden Power):?/i;

const zeroStats = (): StatTable => ({
  hp: 0,
  atk: 0,
  def: 0,
  spa: 0,
  spd: 0,
  spe: 0,
});

/** Reads a Showdown paste. Unreadable lines are reported, not fatal. */
export function parseShowdown(text: string): ParseResult {
  const sets: TeamSet[] = [];
  const errors: Problem[] = [];
  let set: TeamSet | null = null;
  // Set after a seventh Pokémon, whose lines are skipped.
  let skipping = false;

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    const lineNo = index + 1;
    // A blank line ends a Pokémon; team headers ("=== [format] Name ===") are skipped.
    if (line === "" || line.startsWith("===")) {
      set = null;
      skipping = false;
      return;
    }
    if (skipping) return;
    const report = (message: string) =>
      errors.push({ slot: sets.length || null, message, line: lineNo });

    if (!set) {
      if (sets.length === 6) {
        errors.push({
          slot: null,
          message: "A team has at most six Pokémon",
          line: lineNo,
        });
        skipping = true;
        return;
      }
      set = emptySet();
      sets.push(set);
      readFirstLine(line, set, report);
      return;
    }

    const field = line.match(/^([A-Za-z ]+):\s*(.*)$/);
    const label = field?.[1]?.toLowerCase();
    const value = field?.[2] ?? "";
    if (line.startsWith("-")) {
      const name = line.replace(/^-\s*/, "");
      const id = findId("move", name);
      if (set.moveIds.length === 4) report("A Pokémon has at most four moves");
      else if (id) set.moveIds.push(id);
      else report(`Unknown move "${name}"`);
    } else if (/ Nature$/i.test(line)) {
      const name = line.replace(/ Nature$/i, "");
      set.natureId = findId("nature", name);
      if (!set.natureId) report(`Unknown nature "${name}"`);
    } else if (label === "ability") {
      set.abilityId = findId("ability", value);
      if (!set.abilityId) report(`Unknown ability "${value}"`);
    } else if (label === "evs") {
      set.statPoints = readStats(value, zeroStats(), "stat points", report);
    } else if (label === "ivs") {
      set.ivs = readStats(value, perfectIvs(), "IVs", report);
      if (Object.values(set.ivs).some((iv) => iv > MAX_IV)) {
        report(`IVs can be at most ${MAX_IV}`);
        set.ivs = perfectIvs();
      }
    } else if (label === "level") {
      const level = Number(value);
      if (Number.isInteger(level) && level >= 1 && level <= 100) {
        set.level = level;
      } else {
        report(`Level must be from 1 to 100, not "${value}"`);
      }
    } else if (label === "shiny") {
      set.shiny = /^yes$/i.test(value);
    } else if (!IGNORED.test(line)) {
      report(`Couldn't read "${line}"`);
    }
  });

  return { team: { sets }, errors };
}

function readFirstLine(
  line: string,
  set: TeamSet,
  report: (m: string) => void,
) {
  // "Nickname (Species) (F) @ Item", where everything but the species is optional.
  const at = line.lastIndexOf(" @ ");
  let left = at === -1 ? line : line.slice(0, at);
  const itemName = at === -1 ? null : line.slice(at + 3).trim();

  let gender: "M" | "F" | null = null;
  const genderMatch = left.match(/\s*\((M|F)\)$/);
  if (genderMatch) {
    gender = genderMatch[1] as "M" | "F";
    left = left.slice(0, genderMatch.index).trim();
  }
  let speciesName = left;
  const nicknamed = left.match(/^(.*\S)\s*\(([^()]+)\)$/);
  if (nicknamed) {
    set.nickname = nicknamed[1]!;
    speciesName = nicknamed[2]!;
  }

  set.speciesId = findSpeciesId(speciesName, gender);
  if (!set.speciesId) report(`Unknown Pokémon "${speciesName}"`);
  if (itemName) {
    set.itemId = findId("item", itemName);
    if (!set.itemId) report(`Unknown item "${itemName}"`);
  }
}

/** Reads "4 HP / 32 Atk" on top of `stats`, which holds the unlisted values. */
function readStats(
  text: string,
  stats: StatTable,
  label: string,
  report: (m: string) => void,
): StatTable {
  for (const part of text.split("/")) {
    const match = part.trim().match(/^(\d+)\s+([A-Za-z]+)$/);
    const stat = match && STAT_NAMES[match[2]!.toLowerCase()];
    if (match && stat) stats[stat] = Number(match[1]);
    else report(`Couldn't read ${label} "${part.trim()}"`);
  }
  return stats;
}

/** "32 Atk / 2 Spe": every stat whose value isn't `skip`. */
function writeStats(stats: StatTable, skip: number): string {
  return Object.entries(stats)
    .filter(([, value]) => value !== skip)
    .map(([stat, value]) => `${value} ${STAT_LABELS[stat as StatId]}`)
    .join(" / ");
}

/** Writes a team as a Showdown paste, the reverse of parseShowdown(). */
export function exportShowdown(team: Team): string {
  return team.sets
    .map((set) => {
      const lines: string[] = [];
      const species = set.speciesId ? nameOf("species", set.speciesId) : "";
      const name = set.nickname ? `${set.nickname} (${species})` : species;
      lines.push(set.itemId ? `${name} @ ${nameOf("item", set.itemId)}` : name);
      if (set.abilityId) {
        lines.push(`Ability: ${nameOf("ability", set.abilityId)}`);
      }
      lines.push(`Level: ${set.level}`);
      if (set.shiny) lines.push("Shiny: Yes");
      const points = set.statPoints ? writeStats(set.statPoints, 0) : "";
      if (points) lines.push(`EVs: ${points}`);
      if (set.natureId) lines.push(`${nameOf("nature", set.natureId)} Nature`);
      const ivs = writeStats(set.ivs, MAX_IV);
      if (ivs) lines.push(`IVs: ${ivs}`);
      for (const move of set.moveIds) lines.push(`- ${nameOf("move", move)}`);
      return lines.join("\n");
    })
    .join("\n\n");
}
