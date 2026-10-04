import { regulationData } from "../game-data/data";
import type { Regulation } from "../regulation";
import { getSpecies } from "./lookup";

// A box is the Pokémon a player owns, for finding teams they can build.
// Each "box species" is something owned separately: regional forms, gender
// forms and Rotom's appliances are their own; forms a Pokémon can switch
// between, or that are only cosmetic (Lycanroc, Vivillon, Alcremie), share
// one. A Mega counts as the Pokémon it Mega Evolves from, since the stones
// aren't tracked.

/** Form names that make a separate box species, after the base name. */
const SEPARATE_FORM = /^(?:Alola|Galar|Hisui|Paldea(?:-.+)?|F)$/;

/** The box species a species counts as (see above). */
export function boxSpecies(speciesId: string): string {
  const species = getSpecies(speciesId);
  if (!species) return speciesId;
  if (species.battleOnlyFromId) return boxSpecies(species.battleOnlyFromId);
  const base = species.baseSpeciesId && getSpecies(species.baseSpeciesId);
  if (!base) return species.id;
  const form = species.name.slice(base.name.length + 1);
  const separate = base.id === "rotom" || SEPARATE_FORM.test(form);
  return separate ? species.id : base.id;
}

export interface BoxTile {
  /** The box species. */
  id: string;
  name: string;
  num: number;
  /** The form whose sprite shows it: itself, or a legal form if it isn't. */
  spriteId: string;
  /** The regulations it's legal in. */
  regulations: Regulation[];
}

let tiles: BoxTile[] | undefined;

/** Every box species legal in any regulation, in Pokédex order. */
export function boxTiles(): BoxTile[] {
  if (tiles) return tiles;
  const legal = new Map<string, Regulation[]>();
  for (const [regulation, data] of Object.entries(regulationData)) {
    for (const speciesId of data?.legality.species ?? []) {
      const list = legal.get(speciesId) ?? [];
      legal.set(speciesId, [...list, regulation as Regulation]);
    }
  }
  const byId = new Map<string, BoxTile>();
  for (const [speciesId, regulations] of legal) {
    const id = boxSpecies(speciesId);
    const tile = byId.get(id);
    if (tile) {
      for (const r of regulations) {
        if (!tile.regulations.includes(r)) tile.regulations.push(r);
      }
      continue;
    }
    const species = getSpecies(id)!;
    byId.set(id, {
      id,
      name: species.name,
      num: species.num,
      // Floette's only legal form is Eternal Floette; show that one.
      spriteId: legal.has(id)
        ? species.spriteId
        : getSpecies(speciesId)!.spriteId,
      regulations: [...regulations],
    });
  }
  tiles = [...byId.values()].sort(
    (a, b) => a.num - b.num || a.id.localeCompare(b.id),
  );
  return tiles;
}
