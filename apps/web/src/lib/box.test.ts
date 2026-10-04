import { describe, expect, it } from "vitest";
import {
  decodeBox,
  encodeBox,
  groupByAdded,
  readBoxSort,
  sortTiles,
} from "./box";

const all = ["bulbasaur", "charizard", "incineroar", "rotomwash"];

describe("encodeBox and decodeBox", () => {
  it.each([
    [[]],
    [["charizard"]],
    [["charizard", "incineroar", "rotomwash"]],
    [all],
  ])("round-trips %j", (owned) => {
    expect([...decodeBox(encodeBox(new Set(owned), all), all)]).toEqual(owned);
  });

  it("stores whichever list is shorter", () => {
    expect(encodeBox(new Set(["charizard"]), all)).toBe("+charizard");
    expect(encodeBox(new Set(all.slice(1)), all)).toBe("-bulbasaur");
  });

  it("ignores ids it doesn't know, and values it can't read", () => {
    expect([...decodeBox("+charizard.missingno", all)]).toEqual(["charizard"]);
    expect(decodeBox("nonsense", all).size).toBe(0);
    expect(decodeBox(undefined, all).size).toBe(0);
  });
});

describe("sortTiles", () => {
  const tile = (id: string, types: string[], usage: number) => ({
    id,
    name: id,
    spriteId: id,
    types,
    usage,
    added: "M-A",
  });
  // Pokédex order.
  const tiles = [
    tile("charizard", ["fire", "flying"], 0.2),
    tile("arcanine", ["fire"], 0.2),
    tile("rotomwash", ["electric", "water"], 0.1),
    tile("incineroar", ["fire", "dark"], 0.4),
  ];
  const ids = (by: "dex" | "usage" | "type") =>
    sortTiles(tiles, by).map((t) => t.id);

  it("keeps Pokédex order", () => {
    expect(ids("dex")).toEqual([
      "charizard",
      "arcanine",
      "rotomwash",
      "incineroar",
    ]);
  });

  it("sorts by usage, ties in Pokédex order", () => {
    expect(ids("usage")).toEqual([
      "incineroar",
      "charizard",
      "arcanine",
      "rotomwash",
    ]);
  });

  it("sorts by first type, then second, single types first", () => {
    expect(ids("type")).toEqual([
      "arcanine",
      "charizard",
      "incineroar",
      "rotomwash",
    ]);
  });
});

describe("readBoxSort", () => {
  it("defaults to usage", () => {
    expect(readBoxSort(undefined)).toBe("usage");
    expect(readBoxSort("nonsense")).toBe("usage");
    expect(readBoxSort("dex")).toBe("dex");
  });
});

describe("groupByAdded", () => {
  const tile = (id: string, added: string) => ({
    id,
    name: id,
    spriteId: id,
    types: [],
    usage: 0,
    added,
  });

  it("groups newest regulation first, keeping each group's order", () => {
    const groups = groupByAdded(
      [tile("a", "M-A"), tile("c", "M-C"), tile("b", "M-A"), tile("d", "M-C")],
      ["M-A", "M-B", "M-C"],
    );
    expect(groups.map((g) => [g.regulation, g.tiles.map((t) => t.id)])).toEqual(
      [
        ["M-C", ["c", "d"]],
        ["M-A", ["a", "b"]],
      ],
    );
  });
});
