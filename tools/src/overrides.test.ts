import { describe, expect, it } from "vitest";
import type { Move } from "@ots/core/game-data";
import { applyOverrides, type OverridableData } from "./overrides";

const heatWave: Move = {
  id: "heatwave",
  num: 257,
  name: "Heat Wave",
  typeId: "fire",
  category: "special",
  power: 95,
  accuracy: 90,
  pp: 10,
  priority: 0,
  target: "allAdjacentFoes",
  description: "10% chance to burn the foe(s).",
};

const data: OverridableData = {
  species: [],
  moves: [heatWave],
  abilities: [],
  items: [],
  regulations: {
    "M-C": {
      species: ["charizard", "kingambit"],
      items: ["charizarditey"],
      learnsets: { charizard: ["heatwave", "protect"] },
    },
  },
};

describe("applyOverrides", () => {
  it("patches fields of existing records", () => {
    const result = applyOverrides(data, { moves: { heatwave: { pp: 15 } } });
    expect(result.moves[0]).toEqual({ ...heatWave, pp: 15 });
  });

  it("adds and removes regulation entries", () => {
    const result = applyOverrides(data, {
      regulations: {
        "M-C": {
          species: { remove: ["kingambit"] },
          learnsets: { charizard: { add: ["tailwind"], remove: ["protect"] } },
        },
      },
    });
    expect(result.regulations["M-C"]?.species).toEqual(["charizard"]);
    expect(Object.keys(result.regulations["M-C"]?.learnsets ?? {})).toEqual([
      "charizard",
    ]);
    expect(result.regulations["M-C"]?.learnsets.charizard).toEqual([
      "heatwave",
      "tailwind",
    ]);
  });

  it("rejects overrides that no longer match the data", () => {
    expect(() =>
      applyOverrides(data, { moves: { flamethrower: { pp: 15 } } }),
    ).toThrow('unknown move "flamethrower"');
    expect(() =>
      applyOverrides(data, {
        regulations: { "M-C": { items: { remove: ["focussash"] } } },
      }),
    ).toThrow('"focussash", not in M-C items');
    expect(() => applyOverrides(data, { regulations: { "M-Z": {} } })).toThrow(
      'unknown regulation "M-Z"',
    );
  });
});
