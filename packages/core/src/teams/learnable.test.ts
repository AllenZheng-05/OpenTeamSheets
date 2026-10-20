import { describe, expect, it } from "vitest";
import { learnableAbilities, learnableMoves, setForm } from "./learnable";

describe("setForm", () => {
  it("checks a Mega as the form it changes from", () => {
    expect(setForm("charizardmegay")?.id).toBe("charizard");
    expect(setForm("incineroar")?.id).toBe("incineroar");
    expect(setForm("notapokemon")).toBeUndefined();
  });
});

describe("learnableAbilities", () => {
  it("lists a Pokémon's abilities", () => {
    expect(learnableAbilities("incineroar")).toEqual(["blaze", "intimidate"]);
  });

  it("lists a Mega's base form abilities", () => {
    expect(learnableAbilities("charizardmegax")).toEqual(
      learnableAbilities("charizard"),
    );
  });
});

describe("learnableMoves", () => {
  it("lists the moves a Pokémon learns in the regulation", () => {
    const moves = learnableMoves("incineroar", "M-C");
    expect(moves).toContain("fakeout");
    expect(moves).toContain("partingshot");
    expect(moves).not.toContain("trickroom");
  });

  it("lists a Mega's base form moves", () => {
    expect(learnableMoves("charizardmegay", "M-C")).toEqual(
      learnableMoves("charizard", "M-C"),
    );
  });

  it("has none for an unknown Pokémon", () => {
    expect(learnableMoves("notapokemon", "M-C")).toEqual([]);
  });
});
