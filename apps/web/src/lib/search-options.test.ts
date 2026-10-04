import { describe, expect, it } from "vitest";
import { gameDataOptions, pokemonDetails } from "./search-options";

describe("gameDataOptions", () => {
  const options = gameDataOptions();
  const find = (kind: string, id: string) =>
    options.find((o) => o.kind === kind && o.id === id);

  it("offers Pokémon, and each Mega as its own option", () => {
    expect(find("pokemon", "charizard")?.name).toBe("Charizard");
    expect(find("pokemon", "charizardmegay")?.name).toBe("Charizard-Mega-Y");
  });

  it("offers moves, abilities, items and types", () => {
    expect(find("move", "knockoff")).toBeDefined();
    expect(find("ability", "intimidate")).toBeDefined();
    expect(find("item", "sitrusberry")).toBeDefined();
    expect(find("type", "fairy")).toBeDefined();
  });

  it("lists each kind by name", () => {
    const pokemon = options
      .filter((o) => o.kind === "pokemon")
      .map((o) => o.name);
    expect(pokemon).toEqual(
      [...pokemon].sort((a, b) => a.localeCompare(b, "en")),
    );
  });
});

describe("pokemonDetails", () => {
  it("limits a Pokémon to its own moves and abilities", () => {
    const { moves, abilities } = pokemonDetails("incineroar");
    expect(moves).toContain("fakeout");
    expect(moves).not.toContain("moonblast");
    expect(abilities).toEqual(["blaze", "intimidate"]);
  });

  it("checks a Mega as its base form, plus its own ability", () => {
    const { moves, abilities } = pokemonDetails("charizardmegay");
    expect(moves).toEqual(pokemonDetails("charizard").moves);
    expect(abilities).toContain("drought");
    expect(abilities).toContain("blaze");
  });

  it("has nothing for an unknown Pokémon", () => {
    expect(pokemonDetails("missingno")).toEqual({ moves: [], abilities: [] });
  });
});
