import { describe, expect, it } from "vitest";
import type { Tables } from "@ots/core/db";
import { pokemonView, setFromRow } from "./pokemon";

const row: Tables<"team_sets"> = {
  team_id: "00000000-0000-0000-0000-000000000000",
  slot: 2,
  species_id: "salamence",
  item_id: "salamencite",
  listed_item: null,
  ability_id: "intimidate",
  nature_id: "timid",
  move_1_id: "hypervoice",
  move_2_id: "dracometeor",
  move_3_id: null,
  move_4_id: null,
  sp_hp: null,
  sp_atk: null,
  sp_def: null,
  sp_spa: null,
  sp_spd: null,
  sp_spe: null,
  note: null,
  level: 50,
  iv_hp: 31,
  iv_atk: 0,
  iv_def: 31,
  iv_spa: 31,
  iv_spd: 31,
  iv_spe: 31,
  shiny: true,
};

describe("setFromRow", () => {
  it("turns a row into a team set", () => {
    expect(setFromRow(row)).toEqual({
      nickname: null,
      speciesId: "salamence",
      itemId: "salamencite",
      listedItem: null,
      abilityId: "intimidate",
      natureId: "timid",
      moveIds: ["hypervoice", "dracometeor"],
      statPoints: null,
      level: 50,
      ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 },
      shiny: true,
    });
  });

  it("keeps stat points when they're known", () => {
    const set = setFromRow({ ...row, sp_hp: 2, sp_spa: 32, sp_spe: 32 });
    expect(set.statPoints).toEqual({
      hp: 2,
      atk: 0,
      def: 0,
      spa: 32,
      spd: 0,
      spe: 32,
    });
  });
});

describe("pokemonView", () => {
  it("shows the Mega when the Pokémon holds its stone", () => {
    expect(pokemonView(setFromRow(row), 2)).toMatchObject({
      name: "Salamence-Mega",
      spriteId: "salamence-mega",
      shiny: true,
      types: ["dragon", "flying"],
      item: "Salamencite",
      itemSpriteNum: expect.any(Number),
      ability: "Intimidate",
      nature: "Timid",
      moves: ["Hyper Voice", "Draco Meteor"],
    });
  });

  it("shows the listed species otherwise", () => {
    const view = pokemonView(setFromRow({ ...row, item_id: "lifeorb" }), 2);
    expect(view).toMatchObject({
      name: "Salamence",
      spriteId: "salamence",
      item: "Life Orb",
    });
  });

  it("has no item icon without an item", () => {
    expect(
      pokemonView(setFromRow({ ...row, item_id: null }), 2).itemSpriteNum,
    ).toBeNull();
  });

  it("marks a sheet's errors on the listed ability and moves", () => {
    const view = pokemonView(setFromRow(row), 2, [
      {
        slot: 1,
        message: "Salamence can't learn Hyper Voice",
        field: "move",
        value: "hypervoice",
        reading: "Double-Edge",
      },
    ]);
    expect(view.abilityMark).toBeNull();
    expect(view.moveMarks).toEqual([
      { message: "Salamence can't learn Hyper Voice", reading: "Double-Edge" },
      null,
    ]);
  });
});
