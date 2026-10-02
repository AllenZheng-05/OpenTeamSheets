import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRk9 } from "./rk9";
import { exportShowdown, parseShowdown } from "./showdown";

const fixtures = path.join(import.meta.dirname, "__fixtures__");
const fixture = (name: string) =>
  readFileSync(path.join(fixtures, name), "utf8");

describe("parseShowdown", () => {
  const { team, errors } = parseShowdown(
    fixture("baltimore-2027-01.showdown.txt"),
  );

  it("reads a real team with copy-paste whitespace", () => {
    expect(errors).toEqual([]);
    expect(team.sets.map((s) => s.speciesId)).toEqual([
      "excadrill",
      "salamencemega",
      "tyranitar",
      "indeedee",
      "corviknight",
      "sneasler",
    ]);
    expect(team.sets[0]).toEqual({
      nickname: null,
      speciesId: "excadrill",
      itemId: "focussash",
      abilityId: "sandrush",
      natureId: "jolly",
      moveIds: ["ironhead", "highhorsepower", "rockslide", "protect"],
      statPoints: null,
      // Champions' defaults, since the paste doesn't say.
      level: 50,
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      shiny: false,
    });
  });

  it("reads the EVs line as stat points", () => {
    expect(team.sets[1]?.statPoints).toEqual({
      hp: 2,
      atk: 0,
      def: 0,
      spa: 32,
      spd: 0,
      spe: 32,
    });
  });

  it("reads nicknames and genders, including female forms", () => {
    const { team, errors } = parseShowdown(
      "Psy (Indeedee) (F) @ Psychic Seed\nAbility: Psychic Surge\n- Follow Me",
    );
    expect(errors).toEqual([]);
    expect(team.sets[0]?.nickname).toBe("Psy");
    expect(team.sets[0]?.speciesId).toBe("indeedeef");
  });

  it("reports unknown names with their line", () => {
    const { team, errors } = parseShowdown(
      "Kingambit @ Black Glasses\nAbility: Supreme Overlord\n- Sucker Punch\n- Notamove",
    );
    expect(errors).toEqual([
      { slot: 1, message: 'Unknown move "Notamove"', line: 4 },
    ]);
    expect(team.sets[0]?.moveIds).toEqual(["suckerpunch"]);
  });

  it("rejects a seventh Pokémon and skips its lines", () => {
    const one = "Kingambit\nAbility: Defiant\n- Protect";
    const { team, errors } = parseShowdown(Array(7).fill(one).join("\n\n"));
    expect(team.sets).toHaveLength(6);
    expect(errors.map((e) => e.message)).toEqual([
      "A team has at most six Pokémon",
    ]);
  });

  it("reads level, IVs and shiny", () => {
    const { team, errors } = parseShowdown(
      "Raichu @ Raichunite Y\nAbility: Lightning Rod\nLevel: 100\nShiny: Yes\n" +
        "Timid Nature\nIVs: 0 Atk / 30 Spe\n- Protect",
    );
    expect(errors).toEqual([]);
    expect(team.sets[0]).toMatchObject({
      level: 100,
      shiny: true,
      ivs: { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 30 },
    });
  });

  it("rejects a level outside 1–100 and IVs over 31", () => {
    const { team, errors } = parseShowdown(
      "Raichu\nLevel: 101\nIVs: 32 Atk\n- Protect",
    );
    expect(errors.map((e) => e.message)).toEqual([
      'Level must be from 1 to 100, not "101"',
      "IVs can be at most 31",
    ]);
    expect(team.sets[0]).toMatchObject({ level: 50, ivs: { atk: 31 } });
  });

  it("exports a team that parses back to the same team", () => {
    expect(parseShowdown(exportShowdown(team))).toEqual({ team, errors: [] });
  });

  it("exports level, shiny and IVs in Showdown's order", () => {
    const { team } = parseShowdown(
      "Raichu @ Raichunite Y\nAbility: Lightning Rod\nLevel: 100\nShiny: Yes\n" +
        "EVs: 32 SpA / 32 Spe\nTimid Nature\nIVs: 0 Atk\n- Protect",
    );
    expect(exportShowdown(team)).toBe(
      "Raichu @ Raichunite Y\nAbility: Lightning Rod\nLevel: 100\nShiny: Yes\n" +
        "EVs: 32 SpA / 32 Spe\nTimid Nature\nIVs: 0 Atk\n- Protect",
    );
  });
});

describe("parseRk9", () => {
  const files = readdirSync(path.join(fixtures, "rk9")).sort();

  it.each(files)("reads %s, a real teamlist", (file) => {
    const { team, errors } = parseRk9(fixture(path.join("rk9", file)));
    expect(errors).toEqual([]);
    expect(team.sets).toHaveLength(6);
    for (const set of team.sets) {
      expect(set.speciesId).not.toBeNull();
      expect(set.abilityId).not.toBeNull();
      expect(set.natureId).not.toBeNull();
      expect(set.moveIds.length).toBeGreaterThan(0);
      expect(set.statPoints).toBeNull();
    }
  });

  it("matches the same team pasted in Showdown format", () => {
    const rk9 = parseRk9(fixture("rk9/baltimore-2027-01.txt")).team;
    const showdown = parseShowdown(
      fixture("baltimore-2027-01.showdown.txt"),
    ).team;
    // RK9 names the Mega by its base form, and has no stat points.
    expect(rk9.sets.map((s) => s.moveIds)).toEqual(
      showdown.sets.map((s) => s.moveIds),
    );
    expect(rk9.sets[1]?.speciesId).toBe("salamence");
    expect(rk9.sets[1]?.itemId).toBe("salamencite");
  });

  it("reads RK9's form and gender names", () => {
    const species = files.flatMap((file) =>
      parseRk9(fixture(path.join("rk9", file))).team.sets.map(
        (s) => s.speciesId,
      ),
    );
    expect(species).toEqual(
      expect.arrayContaining([
        "arcaninehisui",
        "floetteeternal",
        "sinistchamasterpiece",
        "indeedee",
        "indeedeef",
      ]),
    );
  });

  it("reads a team copied as single lines", () => {
    const { team, errors } = parseRk9(
      "Arcanine [Hisuian Form] EN Ability: Intimidate Held Item: Choice Scarf " +
        "Stat Alignment: Adamant Head Smash Flare Blitz Extreme Speed Protect",
    );
    expect(errors).toEqual([]);
    expect(team.sets[0]?.moveIds).toEqual([
      "headsmash",
      "flareblitz",
      "extremespeed",
      "protect",
    ]);
  });

  it("explains what to copy when no team is found", () => {
    expect(parseRk9("hello").errors[0]?.message).toMatch(/RK9 teamlist/);
  });
});
