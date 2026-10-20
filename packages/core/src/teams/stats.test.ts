import { describe, expect, it } from "vitest";
import { battleStat } from "./stats";

const adamant = { plusStat: "atk", minusStat: "spa" } as const;

describe("battleStat", () => {
  it("adds base, points and 75 for HP", () => {
    // Incineroar, 95 base HP, 32 points: 202, as at level 50 with 252 EVs.
    expect(battleStat("hp", 95, 32, null)).toBe(202);
    expect(battleStat("hp", 95, 0, adamant)).toBe(170);
  });

  it("adds base, points and 20 for the others", () => {
    // Incineroar, 60 base Speed, no points: 80.
    expect(battleStat("spe", 60, 0, null)).toBe(80);
  });

  it("applies the nature, rounding down", () => {
    // 115 base Attack, 32 points, raised: ⌊167 × 1.1⌋ = 183.
    expect(battleStat("atk", 115, 32, adamant)).toBe(183);
    // 80 base Sp. Atk, lowered: ⌊100 × 0.9⌋ = 90.
    expect(battleStat("spa", 80, 0, adamant)).toBe(90);
  });

  it("isn't thrown off by floating point", () => {
    // 90 + 0 + 20 = 110, × 1.1 is exactly 121.
    expect(battleStat("atk", 90, 0, adamant)).toBe(121);
  });
});
