import { describe, expect, it } from "vitest";
import { toId } from "./ids";

describe("toId", () => {
  it.each([
    ["Charizard-Mega-Y", "charizardmegay"],
    ["Mr. Mime", "mrmime"],
    ["Flabébé", "flabebe"],
    ["  Kingambit ", "kingambit"],
    ["Farfetch’d", "farfetchd"],
    ["U-turn", "uturn"],
  ])("%s -> %s", (name, id) => {
    expect(toId(name)).toBe(id);
  });
});
