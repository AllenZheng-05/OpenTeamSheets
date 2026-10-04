import boxOrder from "../../data/box-order.json";
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

// Box bitsets. Each box species has a permanent index, its position in
// data/box-order.json, which `pnpm data:pull` only ever appends to. A box,
// or a team's Pokémon, is then a 1024-bit mask: bit i set means the box
// species at index i. Indexes never move, so masks and links stay valid as
// Pokémon are added; widening past 1024 means padding with zeros.

/** How many box species a mask can hold. */
export const BOX_BITS = 1024;

const indexes = new Map(boxOrder.map((id, index) => [id, index]));

/** A box species' permanent index, or undefined if it has none yet. */
export const boxIndex = (id: string): number | undefined => indexes.get(id);

/**
 * Box species as compact URL text: the mask's bytes (bit i is byte i / 8,
 * from its high bit), trailing zero bytes trimmed, in base64url.
 */
export function encodeBoxBits(ids: Iterable<string>): string {
  const bytes = new Uint8Array(BOX_BITS / 8);
  for (const id of ids) {
    const index = boxIndex(id);
    if (index !== undefined) bytes[index >> 3]! |= 0x80 >> (index & 7);
  }
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  let binary = "";
  for (const byte of bytes.subarray(0, end))
    binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The box species in encodeBoxBits() text, or null if it isn't valid. */
export function decodeBoxBits(text: string): Set<string> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  let binary: string;
  try {
    binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return null;
  }
  if (binary.length > BOX_BITS / 8) return null;
  const ids = new Set<string>();
  for (let i = 0; i < binary.length * 8; i++) {
    if (binary.charCodeAt(i >> 3) & (0x80 >> (i & 7))) {
      const id = boxOrder[i];
      if (id) ids.add(id);
    }
  }
  return ids;
}

/** A mask as Postgres bit(1024) text: "0" and "1", index 0 first. */
export function boxBitString(ids: Iterable<string>): string {
  const bits = new Array<string>(BOX_BITS).fill("0");
  for (const id of ids) {
    const index = boxIndex(id);
    if (index !== undefined) bits[index] = "1";
  }
  return bits.join("");
}
