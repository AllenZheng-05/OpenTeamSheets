import { describe, expect, it } from "vitest";
import { boxSpecies, boxTiles } from "./box";

describe("boxSpecies", () => {
  it.each([
    ["charizardmegay", "charizard"],
    ["arcaninehisui", "arcaninehisui"],
    ["ninetalesalola", "ninetalesalola"],
    ["taurospaldeaaqua", "taurospaldeaaqua"],
    ["indeedeef", "indeedeef"],
    ["basculegionf", "basculegionf"],
    ["rotomwash", "rotomwash"],
    ["lycanrocdusk", "lycanroc"],
    ["vivillonpokeball", "vivillon"],
    ["alcremierubyswirl", "alcremie"],
    ["toxtricitylowkey", "toxtricity"],
    ["floetteeternal", "floette"],
    ["floettemega", "floette"],
    ["incineroar", "incineroar"],
  ])("%s counts as %s", (species, box) => {
    expect(boxSpecies(species)).toBe(box);
  });
});

describe("boxTiles", () => {
  const tiles = boxTiles();

  it("lists each box species once, in Pokédex order", () => {
    expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length);
    const nums = tiles.map((t) => t.num);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });

  it("merges switchable and cosmetic forms", () => {
    expect(tiles.filter((t) => t.id.startsWith("vivillon"))).toHaveLength(1);
    expect(
      tiles.filter((t) => t.id.startsWith("rotom")).length,
    ).toBeGreaterThan(1);
  });

  it("shows a legal form when the base form isn't legal", () => {
    expect(tiles.find((t) => t.id === "floette")).toMatchObject({
      name: "Floette",
      spriteId: "floette-eternal",
    });
  });

  it("knows which regulations each is legal in", () => {
    expect(tiles.find((t) => t.id === "incineroar")?.regulations).toContain(
      "M-C",
    );
  });
});
