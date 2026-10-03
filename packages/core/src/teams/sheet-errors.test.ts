import { describe, expect, it } from "vitest";
import readings from "../../data/sheet-readings.json";
import { regulationData } from "../game-data/data";
import { teamFingerprint } from "./fingerprint";
import { findId, getSpecies, nameOf } from "./lookup";
import { describeSheetError, sheetErrors } from "./sheet-errors";
import { exportShowdown, parseShowdown } from "./showdown";

const errorsFor = (text: string) =>
  sheetErrors(parseShowdown(text).team, "M-A").filter((e) => e.field);

describe("sheetErrors", () => {
  it("suggests a reviewed reading for a typo, keeping what was listed", () => {
    expect(
      errorsFor(
        "Basculegion-F @ Choice Scarf\nAbility: Adaptability\nAdamant Nature\n- Last Resort",
      ),
    ).toEqual([
      {
        slot: 1,
        message: "Basculegion-F can't learn Last Resort",
        field: "move",
        value: "lastresort",
        reading: "Last Respects",
      },
    ]);
  });

  it("explains a Mega's ability listed before Mega Evolving", () => {
    expect(
      errorsFor(
        "Charizard @ Charizardite Y\nAbility: Drought\nModest Nature\n- Heat Wave",
      ),
    ).toEqual([
      {
        slot: 1,
        message:
          "Drought is Charizard-Mega-Y's ability, so Charizard's own isn't known",
        field: "ability",
        value: "drought",
        megaAbility: true,
      },
    ]);
  });

  describe("an item that isn't in the game, kept as listed", () => {
    const team = parseShowdown(
      "Indeedee\nAbility: Psychic Surge\nModest Nature\n- Trick",
    ).team;
    const listed = {
      sets: [{ ...team.sets[0]!, listedItem: "Choice Band" }],
    };

    it("is an error, with our reading", () => {
      expect(sheetErrors(listed, "M-C").filter((e) => e.field)).toEqual([
        {
          slot: 1,
          message: "Choice Band isn't in Pokémon Champions",
          field: "item",
          value: "Choice Band",
          reading: "Choice Scarf",
        },
      ]);
    });

    it("exports as listed", () => {
      expect(exportShowdown(listed)).toMatch(/^Indeedee @ Choice Band$/m);
    });

    it("tells the team apart from the same team with no item", () => {
      expect(teamFingerprint(listed, "M-C")).not.toBe(
        teamFingerprint(team, "M-C"),
      );
    });
  });

  it("recognizes a field left blank, which lists the first option", () => {
    expect(
      errorsFor(
        "Scizor @ Scizorite\nAbility: Adaptability\nAdamant Nature\n- Accelerock",
      ),
    ).toEqual([
      expect.objectContaining({ value: "adaptability", leftBlank: true }),
      expect.objectContaining({ value: "accelerock", leftBlank: true }),
    ]);
  });

  it("leaves other errors without a reading", () => {
    const [error] = errorsFor(
      "Incineroar @ Sitrus Berry\nAbility: Intimidate\nCareful Nature\n- Knock Off",
    );
    expect(error?.reading).toBeUndefined();
    expect(error?.megaAbility).toBeUndefined();
  });
});

describe("describeSheetError", () => {
  it.each([
    [{ reading: "Last Respects" }, " (probably Last Respects)"],
    [{ leftBlank: true }, " (probably left blank)"],
    [{}, ""],
  ])("%o", (extra, suffix) => {
    expect(
      describeSheetError({
        slot: 5,
        message: "Basculegion can't learn Last Resort",
        ...extra,
      }),
    ).toBe(`Slot 5: Basculegion can't learn Last Resort${suffix}`);
  });
});

describe("sheet-readings.json", () => {
  const learnable = (species: string, move: string) =>
    Object.values(regulationData).some((data) =>
      data?.learnsets[species]?.includes(move),
    );

  it.each(readings.items)(
    "$species: $listed reads as $reading",
    ({ species, listed, reading }) => {
      expect(getSpecies(species)).toBeDefined();
      expect(findId("item", listed)).toBeNull();
      expect(
        Object.values(regulationData).some((data) =>
          data?.legality.items.includes(reading),
        ),
      ).toBe(true);
    },
  );

  it.each(readings.abilities)(
    "$species: $listed reads as $reading",
    ({ species, listed, reading }) => {
      const form = getSpecies(species)!;
      const abilities = [form.ability1, form.ability2, form.abilityHidden];
      expect(nameOf("ability", listed)).not.toBe(listed);
      expect(abilities).not.toContain(listed);
      expect(abilities).toContain(reading);
    },
  );

  it.each(readings.moves)(
    "$species: $listed reads as $reading",
    ({ species, listed, reading }) => {
      expect(getSpecies(species)).toBeDefined();
      expect(nameOf("move", listed)).not.toBe(listed);
      expect(learnable(species, listed)).toBe(false);
      expect(learnable(species, reading)).toBe(true);
    },
  );
});
