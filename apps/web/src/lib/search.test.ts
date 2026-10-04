import { describe, expect, it } from "vitest";
import {
  emptyFilters,
  filtersHref,
  hasFilters,
  placementLabel,
  readPlacement,
  readCondition,
  readFilters,
  rpcFilters,
  writeCondition,
  type Filters,
} from "./search";

const params = (href: string) => {
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of new URL(href, "https://x").searchParams) {
    const existing = result[key];
    result[key] =
      existing === undefined
        ? value
        : [...(Array.isArray(existing) ? existing : [existing]), value];
  }
  return result;
};

describe("conditions", () => {
  it.each([
    ["pokemon:incineroar", { pokemon: "incineroar" }],
    ["move:knockoff", { moves: ["knockoff"] }],
    [
      "pokemon:incineroar,move:knockoff,move:fakeout,ability:intimidate,item:sitrusberry",
      {
        pokemon: "incineroar",
        moves: ["knockoff", "fakeout"],
        ability: "intimidate",
        item: "sitrusberry",
      },
    ],
    ["type:fairy", { type: "fairy" }],
  ])("reads and writes %s", (text, condition) => {
    expect(readCondition(text)).toEqual(condition);
    expect(writeCondition(condition)).toBe(text);
  });

  it.each([
    "pokemon:",
    "pokemon:Incineroar",
    "species:incineroar",
    "pokemon:a,pokemon:b",
    "move:a,move:b,move:c,move:d,move:e",
    "pokemon:a:b",
    "",
  ])("rejects %j", (text) => {
    expect(readCondition(text)).toBeNull();
  });
});

describe("readFilters and filtersHref", () => {
  const full: Filters = {
    has: [{ pokemon: "incineroar", moves: ["knockoff"] }, { type: "fairy" }],
    not: [{ pokemon: "sneasler" }],
    archetypes: ["trick-room"],
    notArchetypes: ["sun"],
    players: ["wolfe"],
    notPlayers: ["Ash Ketchum"],
    errors: "unexplained",
    regulation: "all",
    event: "baltimore-2026",
    stage: "top-cut",
    top: 32,
  };

  it("round-trips every filter through the URL", () => {
    const href = filtersHref("/tournament", full, "M-C", 2);
    expect(readFilters(params(href), "M-C")).toEqual(full);
    expect(params(href).page).toBe("2");
  });

  it("keeps the URL readable", () => {
    expect(
      filtersHref(
        "/tournament",
        {
          ...emptyFilters("M-C"),
          has: [{ pokemon: "incineroar", moves: ["knockoff"] }],
        },
        "M-C",
      ),
    ).toBe("/tournament?has=pokemon:incineroar,move:knockoff");
  });

  it("leaves out defaults, including the current regulation", () => {
    expect(filtersHref("/", emptyFilters("M-C"), "M-C")).toBe("/");
    expect(
      filtersHref("/", { ...emptyFilters("M-C"), regulation: "M-B" }, "M-C"),
    ).toBe("/?reg=M-B");
  });

  it("drops anything malformed", () => {
    expect(
      readFilters(
        {
          has: ["pokemon:incineroar", "pokemon:<script>", "nonsense"],
          not: "archetype:Sun!",
          errors: "some",
          reg: "Z-Z",
          event: "../etc",
          stage: "finals",
          top: "-3",
          player: ["  wolfe  ", "", "x".repeat(51)],
        },
        "M-C",
      ),
    ).toEqual({
      ...emptyFilters("M-C"),
      has: [{ pokemon: "incineroar" }],
      players: ["wolfe"],
    });
  });

  it("ignores repeated filters", () => {
    expect(
      readFilters(
        { has: ["type:fire", "type:fire"], player: ["a", "a"] },
        "M-C",
      ),
    ).toMatchObject({ has: [{ type: "fire" }], players: ["a"] });
  });

  it("knows when anything beyond the defaults is chosen", () => {
    expect(hasFilters(emptyFilters("M-C"), "M-C")).toBe(false);
    expect(hasFilters({ ...emptyFilters("M-C"), stage: "day-2" }, "M-C")).toBe(
      true,
    );
  });
});

describe("rpcFilters", () => {
  it("turns defaults into nulls for search_placements()", () => {
    expect(
      rpcFilters({ ...emptyFilters("M-C"), regulation: "all" }),
    ).toMatchObject({
      regulation: null,
      stage: null,
      event: null,
      errors: null,
    });
    expect(rpcFilters(emptyFilters("M-C")).regulation).toBe("M-C");
  });
});

describe("readPlacement", () => {
  it.each([
    ["", { stage: "all", top: null }],
    ["Any", { stage: "all", top: null }],
    ["Day 2", { stage: "day-2", top: null }],
    ["top  cut", { stage: "top-cut", top: null }],
    ["16", { stage: "all", top: 16 }],
    ["Top 32", { stage: "all", top: 32 }],
    ["top3", { stage: "all", top: 3 }],
  ])("%j", (text, placement) => {
    expect(readPlacement(text)).toEqual(placement);
  });

  it.each(["0", "-4", "2.5", "top", "finals"])("rejects %j", (text) => {
    expect(readPlacement(text)).toBeNull();
  });

  it("labels what it reads", () => {
    expect(placementLabel("all", 8)).toBe("Top 8");
    expect(placementLabel("top-cut", null)).toBe("Top cut");
    expect(placementLabel("all", null)).toBe("");
  });
});
