/**
 * Mirrors the game data in packages/core/data into the database.
 *
 * Usage: pnpm data:sync [--prod [--yes]]
 */
import { REGULATIONS } from "@ots/core";
import type { Database, TablesInsert } from "@ots/core/db";
import {
  gameData,
  getRegulationDataStatus,
  regulationData,
} from "@ots/core/game-data";
import { boxSpecies } from "@ots/core/teams";
import { check, connect, type Db } from "./supabase";

type TableName = keyof Database["public"]["Tables"];

// PostgREST handles large requests poorly; send rows in batches.
const BATCH_SIZE = 1000;

async function upsert<T extends TableName>(
  db: Db,
  table: T,
  rows: TablesInsert<T>[],
) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    check(
      // supabase-js can't infer row types from a generic table name; `rows`
      // is already checked against the table above.
      await db.from(table).upsert(batch as never),
      `Upserting ${table}`,
    );
  }
  console.log(`${table}: ${rows.length}`);
}

const db = await connect(process.argv.slice(2));
const { types, typeChart, natures, species, moves, abilities, items } =
  gameData;

await upsert(db, "types", types);
await upsert(
  db,
  "type_effectiveness",
  Object.entries(typeChart).flatMap(([attacker, row]) =>
    Object.entries(row).map(([defender, multiplier]) => ({
      attacking_type_id: attacker,
      defending_type_id: defender,
      multiplier,
    })),
  ),
);
await upsert(db, "abilities", abilities);
// The sprite position is only for the site's icons, not a database column.
await upsert(
  db,
  "items",
  items.map(({ id, num, name, description }) => ({
    id,
    num,
    name,
    description,
  })),
);
await upsert(
  db,
  "natures",
  natures.map((n) => ({
    id: n.id,
    name: n.name,
    plus_stat: n.plusStat,
    minus_stat: n.minusStat,
  })),
);
await upsert(
  db,
  "moves",
  moves.map((m) => ({
    id: m.id,
    num: m.num,
    name: m.name,
    type_id: m.typeId,
    category: m.category,
    power: m.power,
    accuracy: m.accuracy,
    pp: m.pp,
    priority: m.priority,
    target: m.target,
    description: m.description,
  })),
);
// Base forms, then other forms, then battle-only forms, so every
// base_species_id and battle_only_from_id already exists when it's used.
const insertOrder = (s: (typeof species)[number]) =>
  s.battleOnlyFromId !== null ? 2 : s.baseSpeciesId !== null ? 1 : 0;
await upsert(
  db,
  "species",
  [...species]
    .sort((a, b) => insertOrder(a) - insertOrder(b))
    .map((s) => ({
      id: s.id,
      num: s.num,
      name: s.name,
      base_species_id: s.baseSpeciesId,
      battle_only_from_id: s.battleOnlyFromId,
      type1_id: s.type1,
      type2_id: s.type2,
      ability_1_id: s.ability1,
      ability_2_id: s.ability2,
      ability_hidden_id: s.abilityHidden,
      hp: s.hp,
      atk: s.atk,
      def: s.def,
      spa: s.spa,
      spd: s.spd,
      spe: s.spe,
      required_item_id: s.requiredItemId,
      required_ability_id: s.requiredAbilityId,
      required_move_id: s.requiredMoveId,
      // Which Pokémon a player owns to have this one, for box matching.
      box_species_id: boxSpecies(s.id),
    })),
);

await upsert(
  db,
  "regulations",
  REGULATIONS.map((r) => ({
    id: r.id,
    starts_at: r.startsAt,
    data_status: getRegulationDataStatus(r.id),
    showdown_commit: regulationData[r.id]?.legality.showdownCommit ?? null,
  })),
);

// Replace each regulation's legality and learnsets, so entries removed from
// the data are removed here too. Deleting species cascades to learnsets.
for (const [regulation, data] of Object.entries(regulationData)) {
  console.log(`Regulation ${regulation}:`);
  for (const table of ["regulation_species", "regulation_items"] as const) {
    check(
      await db.from(table).delete().eq("regulation_id", regulation),
      `Clearing ${table}`,
    );
  }
  await upsert(
    db,
    "regulation_species",
    data.legality.species.map((id) => ({
      regulation_id: regulation,
      species_id: id,
    })),
  );
  await upsert(
    db,
    "regulation_items",
    data.legality.items.map((id) => ({
      regulation_id: regulation,
      item_id: id,
    })),
  );
  await upsert(
    db,
    "regulation_learnsets",
    Object.entries(data.learnsets).flatMap(([speciesId, moveIds]) =>
      moveIds.map((moveId) => ({
        regulation_id: regulation,
        species_id: speciesId,
        move_id: moveId,
      })),
    ),
  );
}

// Search tags include each Pokémon's types, Mega form and box species,
// which come from the game data; recompute them in case those changed.
// In batches of teams, each well within the API's statement timeout.
let after: string | undefined;
let batches = 0;
for (;;) {
  const { data } = check(
    await db.rpc("refresh_search_tags", { p_after: after }),
    "Refreshing search tags",
  );
  if (!data) break;
  after = data;
  batches++;
}
console.log(`search tags: refreshed in ${batches} batches`);
