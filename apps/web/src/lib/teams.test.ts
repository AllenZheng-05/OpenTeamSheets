import { describe, expect, it } from "vitest";
import { resultTotals } from "./teams";

describe("resultTotals", () => {
  const result = (
    record: string | null,
    stage: "top-cut" | "day-2" | null,
  ) => ({
    id: "x",
    player: "x",
    placement: 1,
    record,
    stage,
    teamlistUrl: null,
    event: {
      slug: "x",
      name: "x",
      official: true,
      dates: "",
      regulation: "M-C",
      playerCount: null,
      standingsUrl: null,
    },
  });

  it("adds up uses, stages and records", () => {
    expect(
      resultTotals([
        result("15-2", "top-cut"),
        result("8-3", "day-2"),
        result(null, null),
      ]),
    ).toEqual({
      uses: 3,
      official: 3,
      online: 0,
      topCuts: 1,
      dayTwos: 2,
      record: { wins: 23, losses: 5 },
    });
  });

  it("has no record without any", () => {
    expect(resultTotals([result(null, null)]).record).toBeNull();
  });
});
