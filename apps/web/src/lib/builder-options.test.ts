import { describe, expect, it } from "vitest";
import { fieldOptions, searchSpecies, speciesChoice } from "./builder-options";

const ids = (options: { id: string; group?: string }[], group?: string) =>
  options.filter((o) => o.group === group).map((o) => o.id);

describe("searchSpecies", () => {
  it("finds Pokémon by name, without groups when nothing else matches", () => {
    const found = searchSpecies("incin", "M-C");
    expect(found.map((o) => o.id)).toEqual(["incineroar"]);
    expect(found[0]!.group).toBeUndefined();
  });

  it("finds Pokémon with an ability, grouped under it", () => {
    const found = searchSpecies("intimidate", "M-C");
    expect(ids(found, "With Intimidate")).toContain("incineroar");
    expect(ids(found, "With Intimidate")).not.toContain("charizard");
  });

  it("finds Pokémon that learn a move in the regulation", () => {
    const found = searchSpecies("fake out", "M-C");
    expect(ids(found, "Learns Fake Out")).toContain("incineroar");
    expect(ids(found, "Learns Fake Out")).not.toContain("charizard");
  });

  it("lists matches by name first", () => {
    // "Blaze" is an ability, and no Pokémon is named it; "Charizard" is
    // both a name and has Blaze.
    const found = searchSpecies("char", "M-C");
    expect(found[0]!.group).toBe("Pokémon");
    expect(found[0]!.id).toBe("charizard");
  });

  it("gives each row its own key, even for a Pokémon listed twice", () => {
    const found = searchSpecies("intimidate", "M-C");
    expect(new Set(found.map((o) => o.key)).size).toBe(found.length);
  });

  it("only searches by name for one letter", () => {
    expect(searchSpecies("i", "M-C").every((o) => !o.group)).toBe(true);
  });
});

describe("Pokémon rows", () => {
  it("carry types, abilities and base stats, as in Showdown's list", () => {
    const garchomp = fieldOptions("species").find((o) => o.id === "garchomp");
    expect(garchomp?.species).toEqual({
      spriteId: "garchomp",
      types: ["dragon", "ground"],
      abilities: ["Sand Veil"],
      hidden: "Rough Skin",
      stats: [108, 130, 95, 80, 85, 102],
      total: 600,
    });
  });
});

describe("Megas", () => {
  it("are in the list with their own ability and stats", () => {
    const mega = fieldOptions("species").find((o) => o.id === "charizardmegax");
    expect(mega?.species).toMatchObject({
      types: ["fire", "dragon"],
      abilities: ["Tough Claws"],
      hidden: null,
      stats: [78, 130, 111, 130, 85, 100],
    });
  });

  it("are found by their ability", () => {
    const found = searchSpecies("tough claws", "M-C");
    expect(ids(found, "With Tough Claws")).toContain("charizardmegax");
  });
});

describe("speciesChoice", () => {
  it("picks a Mega as its base form holding its stone", () => {
    expect(speciesChoice("charizardmegay", null)).toEqual({
      speciesId: "charizard",
      abilityId: "blaze",
      itemId: "charizarditey",
      listedItem: null,
    });
  });

  it("keeps an ability the Pokémon can have, else takes its first", () => {
    expect(speciesChoice("incineroar", "intimidate").abilityId).toBe(
      "intimidate",
    );
    expect(speciesChoice("incineroar", "levitate").abilityId).toBe("blaze");
  });

  it("leaves the item alone for a Pokémon that isn't a Mega", () => {
    expect(speciesChoice("incineroar", null)).not.toHaveProperty("itemId");
  });
});
