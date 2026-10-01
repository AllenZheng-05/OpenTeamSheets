import type {
  Ability,
  Item,
  Learnsets,
  Move,
  Species,
} from "@ots/core/game-data";

interface ListChange {
  add?: string[];
  remove?: string[];
}

/**
 * Hand corrections from packages/core/data/overrides.json, applied after the
 * Showdown export for anything Showdown gets wrong. Record overrides change
 * fields of an existing record; they can't create new records.
 */
export interface Overrides {
  species?: Record<string, Partial<Species>>;
  moves?: Record<string, Partial<Move>>;
  abilities?: Record<string, Partial<Ability>>;
  items?: Record<string, Partial<Item>>;
  regulations?: Record<
    string,
    {
      species?: ListChange;
      items?: ListChange;
      learnsets?: Record<string, ListChange>;
    }
  >;
}

export interface RegulationData {
  species: string[];
  items: string[];
  learnsets: Learnsets;
}

export interface OverridableData {
  species: Species[];
  moves: Move[];
  abilities: Ability[];
  items: Item[];
  regulations: Record<string, RegulationData>;
}

function patchRecords<T extends { id: string }>(
  kind: string,
  records: T[],
  patches: Record<string, Partial<T>> | undefined,
): T[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  for (const [id, patch] of Object.entries(patches ?? {})) {
    const record = byId.get(id);
    if (!record) throw new Error(`Override for unknown ${kind} "${id}"`);
    byId.set(id, { ...record, ...patch, id });
  }
  return records.map((record) => byId.get(record.id)!);
}

function changeList(
  label: string,
  list: string[],
  change: ListChange | undefined,
): string[] {
  const result = new Set(list);
  for (const id of change?.remove ?? []) {
    if (!result.delete(id)) {
      throw new Error(`Override removes "${id}", not in ${label}`);
    }
  }
  for (const id of change?.add ?? []) result.add(id);
  return [...result].sort();
}

export function applyOverrides(
  data: OverridableData,
  overrides: Overrides,
): OverridableData {
  const regulations: Record<string, RegulationData> = {};
  for (const [id, regulation] of Object.entries(data.regulations)) {
    const change = overrides.regulations?.[id];
    const species = changeList(
      `${id} species`,
      regulation.species,
      change?.species,
    );
    // Only legal species have learnsets.
    const learnsets: Learnsets = {};
    for (const speciesId of species) {
      learnsets[speciesId] = changeList(
        `${id} ${speciesId} learnset`,
        regulation.learnsets[speciesId] ?? [],
        change?.learnsets?.[speciesId],
      );
    }
    for (const speciesId of Object.keys(change?.learnsets ?? {})) {
      if (!species.includes(speciesId)) {
        throw new Error(`Learnset override for "${speciesId}", not in ${id}`);
      }
    }
    regulations[id] = {
      species,
      items: changeList(`${id} items`, regulation.items, change?.items),
      learnsets,
    };
  }
  for (const id of Object.keys(overrides.regulations ?? {})) {
    if (!data.regulations[id]) {
      throw new Error(`Override for unknown regulation "${id}"`);
    }
  }

  return {
    species: patchRecords("species", data.species, overrides.species),
    moves: patchRecords("move", data.moves, overrides.moves),
    abilities: patchRecords("ability", data.abilities, overrides.abilities),
    items: patchRecords("item", data.items, overrides.items),
    regulations,
  };
}
