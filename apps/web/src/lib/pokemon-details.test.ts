import { describe, expect, it } from "vitest";
import { emptySet, type TeamSet } from "@ots/core/teams";
import { setDetails } from "./pokemon-details";

const set = (fields: Partial<TeamSet>): TeamSet => ({
  ...emptySet(),
  ...fields,
});

describe("setDetails", () => {
  it("shows a Pokémon holding its Mega Stone in both forms", () => {
    const details = setDetails(
      set({
        speciesId: "salamence",
        itemId: "salamencite",
        abilityId: "intimidate",
        natureId: "timid",
        moveIds: ["protect"],
      }),
    )!;
    expect(
      details.forms.map((f) => [f.name, f.ability?.name, f.total]),
    ).toEqual([
      ["Salamence", "Intimidate", 600],
      ["Salamence-Mega", "Aerilate", 700],
    ]);
    expect(details.forms[1]!.stats.def).toBe(130);
    expect(details.nature).toEqual({
      name: "Timid",
      plus: "spe",
      minus: "atk",
    });
    expect(details.item?.description).toMatch(/Mega Evolve/);
    expect(details.moves[0]).toMatchObject({
      name: "Protect",
      category: "status",
      accuracy: null,
      priority: 4,
    });
  });

  it("shows one form without a Mega Stone", () => {
    const details = setDetails(
      set({ speciesId: "incineroar", itemId: "sitrusberry" }),
    )!;
    expect(details.forms.map((f) => f.name)).toEqual(["Incineroar"]);
    expect(details.forms[0]!.types).toEqual(["fire", "dark"]);
  });

  it("starts from the base form when a set lists the Mega itself", () => {
    const details = setDetails(
      set({
        speciesId: "charizardmegay",
        itemId: "charizarditey",
        abilityId: "blaze",
      }),
    )!;
    expect(details.forms.map((f) => [f.name, f.ability?.name])).toEqual([
      ["Charizard", "Blaze"],
      ["Charizard-Mega-Y", "Drought"],
    ]);
  });

  it("keeps an item that isn't in the game as listed, with no description", () => {
    expect(
      setDetails(set({ speciesId: "indeedee", listedItem: "Choice Band" }))!
        .item,
    ).toEqual({ name: "Choice Band", description: null });
  });

  it("has nothing for an unknown Pokémon", () => {
    expect(setDetails(set({ speciesId: null }))).toBeNull();
  });
});
