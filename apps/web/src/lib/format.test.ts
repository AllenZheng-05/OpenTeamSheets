import { describe, expect, it } from "vitest";
import { count, dateRange, percent, placement } from "./format";

describe("placement", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [102, "102nd"],
  ])("%i -> %s", (n, text) => {
    expect(placement(n)).toBe(text);
  });
});

describe("dateRange", () => {
  it.each([
    ["2026-09-18", "2026-09-18", "Sep 18, 2026"],
    ["2026-09-18", "2026-09-20", "Sep 18–20, 2026"],
    ["2026-09-30", "2026-10-02", "Sep 30 – Oct 2, 2026"],
    ["2026-12-30", "2027-01-02", "Dec 30, 2026 – Jan 2, 2027"],
  ])("%s to %s -> %s", (start, end, text) => {
    expect(dateRange(start, end)).toBe(text);
  });
});

describe("percent and count", () => {
  it("rounds to whole percents", () => {
    expect(percent(5, 13)).toBe("38%");
    expect(percent(0, 0)).toBe("0%");
  });

  it("groups thousands", () => {
    expect(count(1079)).toBe("1,079");
  });
});
