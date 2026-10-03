import { describe, expect, it } from "vitest";
import { displaySpecies, itemForm } from "./lookup";

describe("itemForm", () => {
  it("finds the Mega a stone makes", () => {
    expect(itemForm("charizard", "charizarditey")?.id).toBe("charizardmegay");
    expect(itemForm("charizard", "charizarditex")?.id).toBe("charizardmegax");
  });

  it("finds nothing for another Pokémon's stone or a regular item", () => {
    expect(itemForm("salamence", "charizarditey")).toBeUndefined();
    expect(itemForm("charizard", "sitrusberry")).toBeUndefined();
    expect(itemForm("charizard", null)).toBeUndefined();
  });

  it("works from the Mega itself", () => {
    expect(itemForm("charizardmegay", "charizarditey")?.id).toBe(
      "charizardmegay",
    );
  });
});

describe("displaySpecies", () => {
  it("shows the Mega when the Pokémon holds its stone", () => {
    const shown = displaySpecies({
      speciesId: "salamence",
      itemId: "salamencite",
    });
    expect(shown?.id).toBe("salamencemega");
    expect(shown?.spriteId).toBe("salamence-mega");
  });

  it("shows the listed species otherwise", () => {
    expect(
      displaySpecies({ speciesId: "salamence", itemId: "lifeorb" })?.id,
    ).toBe("salamence");
    expect(displaySpecies({ speciesId: null, itemId: null })).toBeUndefined();
  });
});
