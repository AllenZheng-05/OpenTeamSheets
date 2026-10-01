import { describe, expect, it } from "vitest";
import {
  REGULATIONS,
  getCurrentRegulation,
  getNextRegulation,
  isRegulation,
} from "./regulation";

describe("getCurrentRegulation", () => {
  it.each([
    ["2026-01-01T00:00:00Z", "M-A"], // before the first regulation
    ["2026-04-08T02:00:00Z", "M-A"],
    ["2026-06-17T01:59:59Z", "M-A"],
    ["2026-06-17T02:00:00Z", "M-B"],
    ["2026-09-09T01:59:59Z", "M-B"],
    ["2026-09-09T02:00:00Z", "M-C"],
  ])("%s -> %s", (now, id) => {
    expect(getCurrentRegulation(new Date(now))).toBe(id);
  });

  it("keeps the newest regulation current with nothing after it", () => {
    expect(getCurrentRegulation(new Date("2100-01-01T00:00:00Z"))).toBe(
      REGULATIONS.at(-1)?.id,
    );
  });
});

describe("getNextRegulation", () => {
  it.each([
    ["2026-06-17T01:59:59Z", "M-B"],
    ["2026-06-17T02:00:00Z", "M-C"],
    ["2100-01-01T00:00:00Z", undefined], // nothing scheduled yet
  ])("%s -> %s", (now, id) => {
    expect(getNextRegulation(new Date(now))?.id).toBe(id);
  });
});

describe("REGULATIONS", () => {
  it("is sorted by start time", () => {
    const starts = REGULATIONS.map((regulation) =>
      Date.parse(regulation.startsAt),
    );
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});

describe("isRegulation", () => {
  it("recognizes known regulations only", () => {
    expect(isRegulation("M-C")).toBe(true);
    expect(isRegulation("Z-Z")).toBe(false);
  });
});
