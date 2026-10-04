import { describe, expect, it } from "vitest";
import boxOrder from "../../data/box-order.json";
import {
  BOX_BITS,
  boxBitString,
  boxIndex,
  boxSpecies,
  boxTiles,
  decodeBoxBits,
  encodeBoxBits,
} from "./box";

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

describe("box indexes", () => {
  it("gives every box species a permanent index within the mask", () => {
    const missing = boxTiles()
      .map((t) => t.id)
      .filter((id) => boxIndex(id) === undefined);
    // If this fails, run `pnpm data:pull`, which appends new box species to
    // data/box-order.json.
    expect(missing).toEqual([]);
    expect(boxOrder.length).toBeLessThanOrEqual(BOX_BITS);
    expect(new Set(boxOrder).size).toBe(boxOrder.length);
  });
});

describe("encodeBoxBits and decodeBoxBits", () => {
  it.each([[[]], [["charizard"]], [["venusaur", "incineroar", "rotomwash"]]])(
    "round-trips %j",
    (ids) => {
      expect([...decodeBoxBits(encodeBoxBits(ids))!].sort()).toEqual(
        [...ids].sort(),
      );
    },
  );

  it("keeps a full box short", () => {
    const all = boxTiles().map((t) => t.id);
    const text = encodeBoxBits(all);
    expect(text.length).toBeLessThan(Math.ceil(all.length / 6) + 4);
    expect(decodeBoxBits(text)!.size).toBe(all.length);
  });

  it("drops trailing zeros, so masks read the same at any width", () => {
    expect(encodeBoxBits(["venusaur"])).toBe("gA");
    expect([...decodeBoxBits("gAAAAA")!]).toEqual(["venusaur"]);
  });

  it("rejects text that isn't a box", () => {
    expect(decodeBoxBits("not a box!")).toBeNull();
    expect(decodeBoxBits("A".repeat(200))).toBeNull();
  });

  it("writes Postgres bit text with index 0 first", () => {
    const bits = boxBitString(["venusaur"]);
    expect(bits).toHaveLength(BOX_BITS);
    expect(bits.startsWith("10")).toBe(true);
  });
});
