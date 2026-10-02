import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveArchetypes } from "./archetypes";
import { parseRk9 } from "./rk9";
import { parseShowdown } from "./showdown";

const team = (paste: string) => parseShowdown(paste).team;
const rk9 = (file: string) =>
  parseRk9(
    readFileSync(
      path.join(import.meta.dirname, "__fixtures__/rk9", file),
      "utf8",
    ),
  ).team;

describe("deriveArchetypes", () => {
  it("tags a real team by its weather and terrain setters", () => {
    // Tyranitar's Sand Stream and Indeedee's Psychic Surge.
    expect(deriveArchetypes(rk9("baltimore-2027-01.txt"))).toEqual([
      "sand",
      "psychic-terrain",
    ]);
  });

  it("counts a Mega's ability through its stone", () => {
    // Charizard's listed ability is Blaze; Mega Charizard Y's is Drought.
    expect(
      deriveArchetypes(
        team("Charizard @ Charizardite Y\nAbility: Blaze\n- Heat Wave"),
      ),
    ).toEqual(["sun"]);
    expect(
      deriveArchetypes(
        team("Charizard @ Charizardite X\nAbility: Blaze\n- Heat Wave"),
      ),
    ).toEqual([]);
  });

  it("counts setting moves, and a team can have several archetypes", () => {
    expect(
      deriveArchetypes(
        team(
          "Indeedee-F @ Psychic Seed\nAbility: Psychic Surge\n- Trick Room\n\n" +
            "Whimsicott\nAbility: Prankster\n- Tailwind",
        ),
      ),
    ).toEqual(["psychic-terrain", "trick-room", "tailwind"]);
  });

  it("needs a way to trap for Perish Trap", () => {
    const perishSong =
      "Gengar @ Focus Sash\nAbility: Cursed Body\n- Perish Song";
    expect(deriveArchetypes(team(perishSong))).toEqual([]);
    expect(deriveArchetypes(team(`${perishSong}\n- Mean Look`))).toEqual([
      "perish-trap",
    ]);
  });

  it("finds none on a team without setters", () => {
    expect(
      deriveArchetypes(team("Kingambit\nAbility: Defiant\n- Protect")),
    ).toEqual([]);
  });
});
