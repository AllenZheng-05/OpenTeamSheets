import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { teamFingerprint } from "./fingerprint";
import { parseRk9 } from "./rk9";
import { parseShowdown } from "./showdown";
import { validateTeam } from "./validate";

const fixtures = path.join(import.meta.dirname, "__fixtures__");
const read = (file: string) => readFileSync(path.join(fixtures, file), "utf8");
const parse = (file: string) => parseShowdown(read(file)).team;
const messages = (problems: { message: string }[]) =>
  problems.map((p) => p.message);

describe("validateTeam matches Showdown's validator", () => {
  // Verdicts from Showdown's own validator, saved by `pnpm data:pull`.
  const verdicts = JSON.parse(
    read("validator/showdown-verdicts.json"),
  ) as Record<string, { valid: boolean; problems: string[] }>;
  const files = readdirSync(path.join(fixtures, "validator")).filter((f) =>
    f.endsWith(".txt"),
  );

  it("has a verdict for every fixture", () => {
    expect(Object.keys(verdicts).sort()).toEqual(files.sort());
  });

  it.each(files)("%s", (file) => {
    const parsed = parseShowdown(read(path.join("validator", file)));
    const { errors } = validateTeam(parsed.team, "M-C", { complete: true });
    const valid = parsed.errors.length === 0 && errors.length === 0;
    expect(
      { valid, problems: [...messages(parsed.errors), ...messages(errors)] },
      `Showdown says: ${verdicts[file]?.problems.join(" ")}`,
    ).toMatchObject({ valid: verdicts[file]?.valid });
  });
});

describe("validateTeam", () => {
  const valid = parse("validator/valid.txt");

  it("checks a Mega as the form it changes from", () => {
    // Mega Salamence's own ability is Aerilate, but team sheets list the
    // ability it has before Mega Evolving.
    expect(validateTeam(valid, "M-C", { complete: true })).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it.each([
    ["illegal-move.txt", "Excadrill can't learn Moonblast"],
    ["illegal-species.txt", "Cramorant isn't legal in Reg M-C"],
    ["item-clause.txt", "Only one Pokémon can hold Focus Sash"],
    ["mega-without-stone.txt", "Salamence-Mega must hold Salamencite"],
    ["species-clause.txt", "A team can have only one Excadrill"],
    ["stat-over-32.txt", "Tyranitar has 33 stat points in HP; the limit is 32"],
    [
      "too-many-stat-points.txt",
      "Excadrill has 96 stat points; the limit is 66",
    ],
    ["wrong-ability.txt", "Excadrill can't have Intimidate"],
  ])("explains %s in one message", (file, message) => {
    const team = parse(path.join("validator", file));
    expect(
      messages(validateTeam(team, "M-C", { complete: true }).errors),
    ).toEqual([message]);
  });

  it("checks a battle-only form's required ability", () => {
    const team = parseShowdown(
      "Aegislash-Blade @ Leftovers\nAbility: Sweet Veil\nModest Nature\n- Shadow Ball",
    ).team;
    expect(
      messages(validateTeam(team, "M-C", { complete: false }).errors),
    ).toContain("Aegislash-Blade needs the ability Stance Change");
  });

  it("allows drafts to be incomplete, but not finished teams", () => {
    const draft = parseShowdown("Kingambit").team;
    expect(validateTeam(draft, "M-C", { complete: false }).errors).toEqual([]);
    expect(
      messages(validateTeam(draft, "M-C", { complete: true }).errors),
    ).toEqual([
      "A team needs six Pokémon",
      "Choose an ability",
      "Choose a nature",
      "Choose at least one move",
    ]);
  });

  it("accepts official team sheets, which have no stat points", () => {
    const team = parseRk9(read("rk9/baltimore-2027-01.txt")).team;
    expect(validateTeam(team, "M-C", { complete: true }).errors).toEqual([]);
  });

  it("warns instead of checking legality when a regulation has no data", () => {
    const result = validateTeam(valid, "M-D", { complete: true });
    expect(result.errors).toEqual([]);
    expect(messages(result.warnings)).toEqual([
      "Reg M-D's rules aren't available yet, so legality wasn't checked",
    ]);
  });
});

describe("teamFingerprint", () => {
  const showdown = parse("baltimore-2027-01.showdown.txt");
  const rk9 = parseRk9(read("rk9/baltimore-2027-01.txt")).team;

  it("ignores level, IVs and shiny, which don't change the team", () => {
    const restyled = {
      sets: showdown.sets.map((set) => ({
        ...set,
        level: 100,
        ivs: { ...set.ivs, atk: 0 },
        shiny: true,
      })),
    };
    expect(teamFingerprint(restyled, "M-C")).toBe(
      teamFingerprint(showdown, "M-C"),
    );
  });

  it("ignores slot order, move order and nicknames", () => {
    const shuffled = {
      sets: [...showdown.sets].reverse().map((set) => ({
        ...set,
        nickname: "Nick",
        moveIds: [...set.moveIds].reverse(),
      })),
    };
    expect(teamFingerprint(shuffled, "M-C")).toBe(
      teamFingerprint(showdown, "M-C"),
    );
  });

  it("treats a Mega as the form it changes from", () => {
    // The same team as RK9 lists it, minus the stat points in the paste.
    const withoutStatPoints = {
      sets: showdown.sets.map((set) => ({ ...set, statPoints: null })),
    };
    expect(teamFingerprint(rk9, "M-C")).toBe(
      teamFingerprint(withoutStatPoints, "M-C"),
    );
  });

  it("differs between regulations and between different teams", () => {
    expect(teamFingerprint(rk9, "M-B")).not.toBe(teamFingerprint(rk9, "M-C"));
    const other = parseRk9(read("rk9/baltimore-2027-02.txt")).team;
    expect(teamFingerprint(other, "M-C")).not.toBe(teamFingerprint(rk9, "M-C"));
  });
});
