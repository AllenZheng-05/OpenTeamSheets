import { toId } from "../ids";
import { findId, findSpeciesId } from "./lookup";
import {
  emptySet,
  type ParseResult,
  type Problem,
  type TeamSet,
} from "./types";

// Reads text copied from an RK9 public teamlist page. Each Pokémon looks like:
//
//   Arcanine [Hisuian Form]  EN
//   Ability: Intimidate   Held Item: Choice Band
//   Stat Alignment: Adamant
//   Flare Blitz Rock Slide Extreme Speed Protect
//
// Browsers lay copied text out differently (labels and values may share a
// line or not, and the moves are usually on one line), so the text is read
// as one stream of words: the labels mark the fields, and the moves are
// split by matching known move names. Teamlists list every Pokémon once per
// language; only the English (EN) entries are read.

// RK9 writes a form after the base name in brackets; Showdown appends it.
const REGIONAL: Record<string, string> = {
  alolan: "alola",
  galarian: "galar",
  hisuian: "hisui",
  paldean: "paldea",
};

/** The species for an RK9 name such as "Arcanine [Hisuian Form]". */
function findRk9SpeciesId(text: string): string | null {
  const match = text.match(/^(.*?)\s*(?:\[([^\]]*)\])?$/);
  const base = match?.[1] ?? text;
  const bracket = match?.[2]?.trim();
  if (!bracket) return findSpeciesId(base, null);
  if (/^(male|female)$/i.test(bracket)) {
    return findSpeciesId(base, bracket[0]!.toUpperCase() as "M" | "F");
  }
  const words = bracket.replace(/\s+form$/i, "").split(/\s+/);
  const first = toId(words[0] ?? "");
  for (const form of [REGIONAL[first], words.join(" "), words[0]]) {
    if (form) {
      const id = findId("species", `${base}-${form}`);
      if (id) return id;
    }
  }
  return null;
}

/** Words, keeping "[Hisuian Form]" together as one. */
const words = (text: string) => text.match(/\[[^\]]*\]|\S+/g) ?? [];

/** The longest run of words at the end of `text` that names a species. */
function trailingSpecies(text: string): { id: string | null; name: string } {
  const parts = words(text);
  for (
    let start = Math.max(0, parts.length - 5);
    start < parts.length;
    start++
  ) {
    const name = parts.slice(start).join(" ");
    const id = findRk9SpeciesId(name);
    if (id) return { id, name };
  }
  return { id: null, name: parts.slice(-2).join(" ") };
}

/** Up to four moves from the start of `text`, matching the longest names first. */
function leadingMoves(text: string): string[] {
  const parts = words(text);
  const moves: string[] = [];
  let i = 0;
  while (i < parts.length && moves.length < 4) {
    let found = false;
    for (let length = Math.min(4, parts.length - i); length > 0; length--) {
      const id = findId("move", parts.slice(i, i + length).join(" "));
      if (id) {
        moves.push(id);
        i += length;
        found = true;
        break;
      }
    }
    if (!found) break;
  }
  return moves;
}

export function parseRk9(text: string): ParseResult {
  const flat = text.replace(/ /g, " ").replace(/\s+/g, " ");
  const errors: Problem[] = [];
  const sets: TeamSet[] = [];

  // Every "<language code> Ability:" starts a Pokémon.
  const starts = [...flat.matchAll(/\b([A-Z]{2}) Ability:/g)];
  starts.forEach((start, k) => {
    if (start[1] !== "EN") return;
    const before = flat.slice(k === 0 ? 0 : starts[k - 1]!.index!, start.index);
    const end = k + 1 < starts.length ? starts[k + 1]!.index! : flat.length;
    const body = flat.slice(start.index! + start[0].length, end);

    if (sets.length === 6) {
      errors.push({ slot: null, message: "A team has at most six Pokémon" });
      return;
    }
    const set = emptySet();
    sets.push(set);
    const slot = sets.length;

    const species = trailingSpecies(before);
    set.speciesId = species.id;
    if (!species.id)
      errors.push({ slot, message: `Unknown Pokémon "${species.name}"` });

    const fields = body.match(
      /^\s*(.*?)\s*Held Item:\s*(.*?)\s*Stat Alignment:\s*(\S+)\s*(.*)$/,
    );
    if (!fields) {
      errors.push({
        slot,
        message: "Couldn't find the ability, item and nature",
      });
      return;
    }
    const [, ability, item, nature, rest] = fields;
    set.abilityId = findId("ability", ability!);
    if (!set.abilityId)
      errors.push({ slot, message: `Unknown ability "${ability}"` });
    if (item && !/^none$/i.test(item)) {
      set.itemId = findId("item", item);
      if (!set.itemId) errors.push({ slot, message: `Unknown item "${item}"` });
    }
    set.natureId = findId("nature", nature!);
    if (!set.natureId)
      errors.push({ slot, message: `Unknown nature "${nature}"` });
    set.moveIds = leadingMoves(rest!);
    if (set.moveIds.length === 0)
      errors.push({ slot, message: "Couldn't find any moves" });
  });

  if (sets.length === 0) {
    errors.push({
      slot: null,
      message:
        "Couldn't find any Pokémon. Copy the English team list from an RK9 teamlist page.",
    });
  }
  return { team: { sets }, errors };
}
