import { describe, expect, it } from "vitest";
import { normalizeSpeciesId } from "./species";

describe("normalizeSpeciesId", () => {
  it.each([
    ["Charizard-Mega-Y", "charizard-mega-y"],
    ["Mr. Mime", "mr-mime"],
    ["Flabébé", "flabebe"],
    ["  Kingambit ", "kingambit"],
    ["Farfetch’d", "farfetchd"],
  ])("%s -> %s", (name, id) => {
    expect(normalizeSpeciesId(name)).toBe(id);
  });
});
